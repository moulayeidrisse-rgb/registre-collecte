import { describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import { ForbiddenError, NotFoundError } from "@/server/errors";
import { saveSubmission, reviewSubmission } from "@/server/services/submissions";
import { getDashboard } from "@/server/services/dashboard";
import { exportSubmissionsCsv } from "@/server/services/export";
import { getFormReport } from "@/server/services/reports";
import { updateUser } from "@/server/services/users";
import { login, validateSessionToken } from "@/server/services/auth";
import { makeUser, makePublishedForm, VALID_VALUES, PASSWORD } from "./helpers";

describe("tableau de bord", () => {
  it("les indicateurs reflètent les données enregistrées et le périmètre", async () => {
    const admin = await makeUser("ADMIN", "Admin");
    const sup = await makeUser("SUPERVISEUR", "Sup");
    const a1 = await makeUser("AGENT", "Agent A");
    const a2 = await makeUser("AGENT", "Agent B");
    const form = await makePublishedForm(admin, "IND-01", [sup, a1, a2]);

    const s1 = await saveSubmission(a1, { formId: form.id, intent: "submit", values: VALID_VALUES });
    await saveSubmission(a1, { formId: form.id, intent: "submit", values: { ...VALID_VALUES, code_menage: "MEN-0002" } });
    await saveSubmission(a2, { formId: form.id, intent: "draft", values: { code_menage: "MEN-0003" } });
    await reviewSubmission(sup, s1.submission.id, { decision: "VALIDER" });

    const d = await getDashboard(admin);
    expect(d.forms.total).toBe(1);
    expect(d.submissions).toMatchObject({ total: 3, enregistrees: 2, brouillons: 1, validees: 1, enAttente: 1 });
    expect(d.completenessAvg).toBe(100);
    expect(d.perForm[0]).toMatchObject({ code: "IND-01", validees: 1, enAttente: 1, brouillons: 1 });
    expect(d.series.reduce((a, s) => a + s.soumises, 0)).toBe(2);
    expect(d.issueTotals.MANQUANT.erreurs).toBeGreaterThan(0); // le brouillon incomplet

    const dA2 = await getDashboard(a2);
    expect(dA2.submissions).toMatchObject({ total: 1, brouillons: 1, enregistrees: 0 });
    const dSup = await getDashboard(sup);
    expect(dSup.submissions.brouillons).toBe(0);
    expect(dSup.submissions.enregistrees).toBe(2);
  });
});

describe("export CSV et rapports", () => {
  it("export restreint au périmètre, refusé aux agents, formules neutralisées, audité", async () => {
    const admin = await makeUser("ADMIN", "Admin");
    const sup = await makeUser("SUPERVISEUR", "Sup");
    const supOther = await makeUser("SUPERVISEUR", "Sup Autre");
    const agent = await makeUser("AGENT", "Agent");
    const form = await makePublishedForm(admin, "EXP-01", [sup, agent]);
    await saveSubmission(agent, { formId: form.id, intent: "submit", values: { ...VALID_VALUES, programme: "=HYPERLINK(\"http://malveillant\")" } });
    await saveSubmission(agent, { formId: form.id, intent: "draft", values: { code_menage: "MEN-0100" } });

    await expect(exportSubmissionsCsv(agent, { formId: form.id })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(exportSubmissionsCsv(supOther, { formId: form.id })).rejects.toBeInstanceOf(NotFoundError);

    const supCsv = await exportSubmissionsCsv(sup, { formId: form.id });
    expect(supCsv.rowCount).toBe(1); // le brouillon n'est pas visible du superviseur
    expect(supCsv.content).toContain("'=HYPERLINK");
    expect(supCsv.content).toContain("Code ménage [code_menage]");
    expect(supCsv.content.startsWith("﻿")).toBe(true);

    const adminCsv = await exportSubmissionsCsv(admin, { formId: form.id });
    expect(adminCsv.rowCount).toBe(2);
    expect(await prisma.auditLog.count({ where: { action: "export.csv" } })).toBe(2);
  });

  it("rapport : statistiques par question calculées sur les réponses", async () => {
    const admin = await makeUser("ADMIN", "Admin");
    const agent = await makeUser("AGENT", "Agent");
    const form = await makePublishedForm(admin, "RAP-01", [agent]);
    await saveSubmission(agent, { formId: form.id, intent: "submit", values: { ...VALID_VALUES, nb_personnes: "2", nb_enfants: "1" } });
    await saveSubmission(agent, { formId: form.id, intent: "submit", values: { ...VALID_VALUES, code_menage: "MEN-0002", nb_personnes: "6", region: "sud" } });
    const r = await getFormReport(admin, form.id);
    const nb = r.stats.find((s) => s.key === "nb_personnes");
    expect(nb).toMatchObject({ kind: "numeric", answered: 2, min: 2, max: 6, mean: 4 });
    const region = r.stats.find((s) => s.key === "region");
    expect(region && region.kind === "distribution" && region.distribution).toEqual([
      { label: "Nord", count: 1, percent: 50 },
      { label: "Sud", count: 1, percent: 50 },
    ]);
    await expect(getFormReport(agent, form.id)).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("gestion des utilisateurs", () => {
  it("désactivation immédiate des sessions ; dernier administrateur protégé", async () => {
    const admin = await makeUser("ADMIN", "Admin");
    const agent = await makeUser("AGENT", "Agent");
    const { token } = await login(agent.email, PASSWORD);
    await updateUser(admin, agent.id, { name: "Agent", role: "AGENT", isActive: false });
    expect(await validateSessionToken(token)).toBeNull();
    await expect(updateUser(admin, admin.id, { name: "Admin", role: "AGENT", isActive: true })).rejects.toThrow(/propre rôle/);
    await expect(updateUser(agent, admin.id, { name: "x", role: "AGENT", isActive: true })).rejects.toBeInstanceOf(ForbiddenError);
  });
});
