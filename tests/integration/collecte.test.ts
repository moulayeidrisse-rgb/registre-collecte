import { describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import { ForbiddenError, NotFoundError, ValidationError, AppError } from "@/server/errors";
import { saveSubmission, reviewSubmission, listSubmissions, getSubmissionDetail, listAvailableForms } from "@/server/services/submissions";
import { createForm, saveFormDraft, publishForm, startNewVersion, setFormActive, listForms } from "@/server/services/forms";
import { rescanForm } from "@/server/services/quality";
import { makeUser, makePublishedForm, VALID_VALUES, SAMPLE_DRAFT } from "./helpers";

async function setup() {
  const admin = await makeUser("ADMIN", "Admin Test");
  const sup = await makeUser("SUPERVISEUR", "Superviseur Test");
  const agent = await makeUser("AGENT", "Agent Test");
  const other = await makeUser("AGENT", "Autre Agent");
  const form = await makePublishedForm(admin, "TEST-01", [sup, agent]);
  return { admin, sup, agent, other, form };
}

describe("gestion des formulaires", () => {
  it("seul l'administrateur crée et publie ; refus d'une définition incohérente", async () => {
    const { sup, agent, admin } = await setup();
    await expect(createForm(sup, { code: "X-1", title: "Interdit" })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(createForm(agent, { code: "X-2", title: "Interdit" })).rejects.toBeInstanceOf(ForbiddenError);
    const f = await createForm(admin, { code: "neuf-01", title: "Nouveau formulaire" });
    expect(f.code).toBe("NEUF-01");
    await expect(createForm(admin, { code: "NEUF-01", title: "Doublon de code" })).rejects.toBeInstanceOf(ValidationError);
    await expect(publishForm(admin, f.id)).rejects.toThrow("sans question");
    await expect(saveFormDraft(admin, f.id, { ...SAMPLE_DRAFT, fields: [{ ...SAMPLE_DRAFT.fields[0], key: "Clé invalide" }] })).rejects.toBeInstanceOf(ValidationError);
  });

  it("modifier un formulaire publié crée une nouvelle version ; les réponses restent sur l'ancienne", async () => {
    const { admin, agent, form } = await setup();
    const { submission } = await saveSubmission(agent, { formId: form.id, intent: "submit", values: VALID_VALUES });
    const v2 = await startNewVersion(admin, form.id);
    expect(v2.number).toBe(2);
    await saveFormDraft(admin, form.id, { ...SAMPLE_DRAFT, fields: [...SAMPLE_DRAFT.fields, { key: "commentaire", label: "Commentaire", type: "TEXTE", required: false, order: 9 }] });
    await publishForm(admin, form.id);
    const versions = await prisma.formVersion.findMany({ where: { formId: form.id }, orderBy: { number: "asc" } });
    expect(versions.map((v) => v.status)).toEqual(["ARCHIVEE", "PUBLIEE"]);
    const s = await prisma.submission.findUniqueOrThrow({ where: { id: submission.id } });
    expect(s.versionId).toBe(versions[0].id);
  });

  it("un agent ne voit que les formulaires publiés qui lui sont affectés", async () => {
    const { other, agent, admin } = await setup();
    const draftOnly = await createForm(admin, { code: "BROU-01", title: "Jamais publié" });
    expect((await listForms(other)).length).toBe(0);
    const list = await listForms(agent);
    expect(list.map((f) => f.code)).toEqual(["TEST-01"]);
    expect(list.find((f) => f.id === draftOnly.id)).toBeUndefined();
    expect((await listAvailableForms(agent)).length).toBe(1);
  });
});

describe("collecte et validations côté serveur", () => {
  it("enregistre réellement les valeurs typées dans PostgreSQL", async () => {
    const { agent, form } = await setup();
    const { submission } = await saveSubmission(agent, { formId: form.id, intent: "submit", values: VALID_VALUES });
    const values = await prisma.submissionValue.findMany({ where: { submissionId: submission.id }, include: { field: true } });
    const byKey = Object.fromEntries(values.map((v) => [v.field.key, v]));
    expect(Number(byKey.nb_personnes.valueNumber)).toBe(4);
    expect(byKey.date_visite.valueDate?.toISOString().slice(0, 10)).toBe("2026-01-15");
    expect(byKey.beneficiaire.valueBool).toBe(true);
    expect(byKey.equipements.valueJson).toEqual(["eau", "elec"]);
    expect(byKey.region.valueText).toBe("nord");
    const s = await prisma.submission.findUniqueOrThrow({ where: { id: submission.id } });
    expect(s.status).toBe("SOUMISE");
    expect(s.completeness).toBe(100);
    expect(s.submittedAt).not.toBeNull();
  });

  it("brouillon incomplet accepté ; soumission refusée avec messages explicites", async () => {
    const { agent, form } = await setup();
    const draft = await saveSubmission(agent, { formId: form.id, intent: "draft", values: { code_menage: "MEN-0002", nb_personnes: "3" } });
    expect(draft.submission.status).toBe("BROUILLON");
    const issues = await prisma.qualityIssue.findMany({ where: { submissionId: draft.submission.id } });
    expect(issues.some((i) => i.type === "MANQUANT")).toBe(true);

    const err = await saveSubmission(agent, {
      submissionId: draft.submission.id,
      formId: form.id,
      intent: "submit",
      values: { ...VALID_VALUES, code_menage: "123", nb_personnes: "40", nb_enfants: "3", programme: "", date_visite: "2099-01-01" },
    }).catch((e) => e);
    expect(err).toBeInstanceOf(ValidationError);
    const msgs = (err as ValidationError).issues.map((i) => i.message);
    expect(msgs).toContain("« Code ménage » : format MEN-0000");
    expect(msgs.some((m) => m.includes("inférieur ou égal à 30"))).toBe(true);
    expect(msgs).toContain("Indiquez le nom du programme.");
    expect(msgs.some((m) => m.includes("date future"))).toBe(true);
    // rien n'a été modifié en base
    expect((await prisma.submission.findUniqueOrThrow({ where: { id: draft.submission.id } })).status).toBe("BROUILLON");
  });

  it("une valeur non interprétable bloque même l'enregistrement en brouillon", async () => {
    const { agent, form } = await setup();
    await expect(saveSubmission(agent, { formId: form.id, intent: "draft", values: { nb_personnes: "quatre" } })).rejects.toBeInstanceOf(ValidationError);
    await expect(saveSubmission(agent, { formId: form.id, intent: "draft", values: { region: "option-inventee" } })).rejects.toBeInstanceOf(ValidationError);
    expect(await prisma.submission.count()).toBe(0);
  });

  it("refuse la saisie sur un formulaire non affecté ou désactivé", async () => {
    const { other, agent, admin, form } = await setup();
    await expect(saveSubmission(other, { formId: form.id, intent: "draft", values: {} })).rejects.toBeInstanceOf(NotFoundError);
    await setFormActive(admin, form.id, false);
    await expect(saveSubmission(agent, { formId: form.id, intent: "draft", values: {} })).rejects.toBeInstanceOf(NotFoundError);
  });

  it("détecte les doublons potentiels selon les critères configurés (sans bloquer)", async () => {
    const { agent, form } = await setup();
    await saveSubmission(agent, { formId: form.id, intent: "submit", values: VALID_VALUES });
    const second = await saveSubmission(agent, { formId: form.id, intent: "submit", values: { ...VALID_VALUES, code_menage: "men-0001".toUpperCase(), nb_personnes: "5" } });
    expect(second.submission.status).toBe("SOUMISE");
    const dup = await prisma.qualityIssue.findFirst({ where: { submissionId: second.submission.id, type: "DOUBLON" } });
    expect(dup?.severity).toBe("AVERTISSEMENT");
    expect(dup?.message).toMatch(/Doublon potentiel/);
  });

  it("avertissement de vraisemblance enregistré sans bloquer la soumission", async () => {
    const { agent, form } = await setup();
    const r = await saveSubmission(agent, { formId: form.id, intent: "submit", values: { ...VALID_VALUES, nb_personnes: "20" } });
    expect(r.submission.status).toBe("SOUMISE");
    expect(r.warnings[0].message).toMatch(/Valeur inhabituelle/);
  });
});

describe("droits sur les réponses et circuit de validation", () => {
  it("cloisonnement : un agent ne voit pas les réponses d'un autre ; superviseur non affecté non plus", async () => {
    const { agent, other, sup, admin, form } = await setup();
    const { submission } = await saveSubmission(agent, { formId: form.id, intent: "submit", values: VALID_VALUES });
    await expect(getSubmissionDetail(other, submission.id)).rejects.toBeInstanceOf(NotFoundError);
    expect((await listSubmissions(other, {})).total).toBe(0);
    expect((await listSubmissions(sup, {})).total).toBe(1);

    const sup2 = await makeUser("SUPERVISEUR", "Superviseur Non Affecte");
    await expect(getSubmissionDetail(sup2, submission.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(reviewSubmission(sup2, submission.id, { decision: "VALIDER" })).rejects.toBeInstanceOf(NotFoundError);
    expect((await listSubmissions(admin, {})).total).toBe(1);
  });

  it("le superviseur ne voit pas les brouillons des agents", async () => {
    const { agent, sup, form } = await setup();
    await saveSubmission(agent, { formId: form.id, intent: "draft", values: { code_menage: "MEN-0009" } });
    expect((await listSubmissions(sup, {})).total).toBe(0);
  });

  it("agent ne peut pas valider ; superviseur ne peut pas modifier les valeurs", async () => {
    const { agent, sup, form } = await setup();
    const { submission } = await saveSubmission(agent, { formId: form.id, intent: "submit", values: VALID_VALUES });
    await expect(reviewSubmission(agent, submission.id, { decision: "VALIDER" })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(saveSubmission(sup, { submissionId: submission.id, formId: form.id, intent: "submit", values: VALID_VALUES })).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("renvoi pour correction → l'agent corrige → validation → plus modifiable", async () => {
    const { agent, sup, form } = await setup();
    const { submission } = await saveSubmission(agent, { formId: form.id, intent: "submit", values: VALID_VALUES });
    await expect(reviewSubmission(sup, submission.id, { decision: "A_CORRIGER" })).rejects.toThrow(/commentaire est obligatoire/);
    await reviewSubmission(sup, submission.id, { decision: "A_CORRIGER", comment: "Vérifier le nombre d'enfants" });
    await saveSubmission(agent, { submissionId: submission.id, formId: form.id, intent: "submit", values: { ...VALID_VALUES, nb_enfants: "1" } });
    expect(await reviewSubmission(sup, submission.id, { decision: "VALIDER" })).toBe("VALIDEE");
    await expect(saveSubmission(agent, { submissionId: submission.id, formId: form.id, intent: "submit", values: VALID_VALUES })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(reviewSubmission(sup, submission.id, { decision: "REJETER", comment: "trop tard" })).rejects.toBeInstanceOf(AppError);
    const actions = (await prisma.auditLog.findMany({ where: { entityId: submission.id }, orderBy: { createdAt: "asc" } })).map((a) => a.action);
    expect(actions).toEqual(["submission.submit", "submission.return", "submission.submit", "submission.validate"]);
  });

  it("une réponse soumise ne repasse pas en brouillon", async () => {
    const { agent, form } = await setup();
    const { submission } = await saveSubmission(agent, { formId: form.id, intent: "submit", values: VALID_VALUES });
    await expect(saveSubmission(agent, { submissionId: submission.id, formId: form.id, intent: "draft", values: VALID_VALUES })).rejects.toThrow(/ne peut pas repasser en brouillon/);
  });

  it("relance du contrôle qualité réservée à l'administrateur", async () => {
    const { agent, sup, admin, form } = await setup();
    await saveSubmission(agent, { formId: form.id, intent: "submit", values: VALID_VALUES });
    await saveSubmission(agent, { formId: form.id, intent: "submit", values: VALID_VALUES });
    await expect(rescanForm(sup, form.id)).rejects.toBeInstanceOf(ForbiddenError);
    expect(await rescanForm(admin, form.id)).toBe(2);
    expect(await prisma.qualityIssue.count({ where: { type: "DOUBLON" } })).toBe(1);
  });
});
