import "server-only";
import { Prisma } from "@/generated/prisma/client";
import type { SubmissionStatus } from "@/generated/prisma/enums";
import { prisma } from "../db";
import { assertCan, can, formScope, submissionScope, type SessionUser } from "../auth/permissions";
import { AppError, ForbiddenError, NotFoundError, ValidationError } from "../errors";
import { validateSubmission } from "@/lib/validation/engine";
import type { RawValues } from "@/lib/validation/types";
import { toFieldDef, toRuleDefs, toValueColumns, valuesByKey } from "./mappers";
import { computeDuplicateKey, findDuplicates, newReference, persistIssues } from "./quality";
import { audit } from "./audit";
import { z } from "zod";

/** Formulaires ouverts à la saisie pour l'acteur */
export async function listAvailableForms(actor: SessionUser) {
  assertCan(actor, "submission:create");
  const forms = await prisma.form.findMany({
    where: { AND: [formScope(actor), { status: "PUBLIE" }] },
    orderBy: { title: "asc" },
    include: { versions: { where: { status: "PUBLIEE" }, include: { _count: { select: { fields: true } } } } },
  });
  const mine = await prisma.submission.groupBy({
    by: ["formId", "status"],
    where: { agentId: actor.id, formId: { in: forms.map((f) => f.id) } },
    _count: { _all: true },
  });
  return forms.map((f) => ({
    id: f.id,
    code: f.code,
    title: f.title,
    description: f.description,
    version: f.versions[0]?.number ?? null,
    fieldCount: f.versions[0]?._count.fields ?? 0,
    myDrafts: mine.filter((m) => m.formId === f.id && m.status === "BROUILLON").reduce((a, m) => a + m._count._all, 0),
    myToFix: mine.filter((m) => m.formId === f.id && m.status === "A_CORRIGER").reduce((a, m) => a + m._count._all, 0),
    mySubmitted: mine.filter((m) => m.formId === f.id && m.status !== "BROUILLON").reduce((a, m) => a + m._count._all, 0),
  }));
}

/** Version publiée d'un formulaire ouvert à la saisie pour l'acteur */
export async function getFormForEntry(actor: SessionUser, formId: string) {
  assertCan(actor, "submission:create");
  const form = await prisma.form.findFirst({
    where: { AND: [{ id: formId, status: "PUBLIE" }, formScope(actor)] },
    include: { versions: { where: { status: "PUBLIEE" }, include: { fields: { orderBy: { order: "asc" } }, rules: { orderBy: { order: "asc" } } } } },
  });
  const version = form?.versions[0];
  if (!form || !version) throw new NotFoundError("Formulaire introuvable, non publié ou non affecté.");
  return { form, version, fields: version.fields.map(toFieldDef), rules: toRuleDefs(version.rules) };
}

const EDITABLE_BY_AGENT: SubmissionStatus[] = ["BROUILLON", "SOUMISE", "A_CORRIGER"];

/** L'acteur peut-il modifier cette réponse ? (règle unique, utilisée par l'UI et le serveur) */
export function canEditSubmission(
  actor: SessionUser,
  s: { agentId: string; status: SubmissionStatus },
  formStatus: string,
): boolean {
  if (can(actor, "submission:edit_any")) return true;
  if (!can(actor, "submission:create")) return false;
  return s.agentId === actor.id && EDITABLE_BY_AGENT.includes(s.status) && formStatus === "PUBLIE";
}

const saveInputSchema = z.object({
  submissionId: z.string().min(1).max(50).optional(),
  formId: z.string().min(1).max(50),
  intent: z.enum(["draft", "submit"]),
  values: z.record(z.string().max(64), z.union([z.string().max(5000), z.array(z.string().max(200)).max(200), z.boolean(), z.number(), z.null()])),
});

export type SaveSubmissionInput = z.input<typeof saveInputSchema>;

/**
 * Enregistre (brouillon) ou soumet une réponse.
 * Toute la validation est refaite ici, indépendamment du navigateur.
 */
export async function saveSubmission(actor: SessionUser, rawInput: SaveSubmissionInput) {
  const parsed = saveInputSchema.safeParse(rawInput);
  if (!parsed.success) throw new ValidationError("Données envoyées invalides.");
  const input = parsed.data;

  let versionId: string;
  let existing: Awaited<ReturnType<typeof prisma.submission.findUnique>> = null;

  if (input.submissionId) {
    existing = await prisma.submission.findFirst({ where: { AND: [{ id: input.submissionId }, submissionScope(actor)] } });
    if (!existing || existing.formId !== input.formId) throw new NotFoundError("Réponse introuvable ou inaccessible.");
    const form = await prisma.form.findUniqueOrThrow({ where: { id: existing.formId } });
    if (!canEditSubmission(actor, existing, form.status)) {
      throw new ForbiddenError("Cette réponse ne peut plus être modifiée (statut ou droits insuffisants).");
    }
    if (existing.status === "SOUMISE" && input.intent === "draft" && !can(actor, "submission:edit_any")) {
      throw new AppError("Une réponse déjà soumise ne peut pas repasser en brouillon : utilisez « Soumettre » pour enregistrer vos corrections.");
    }
    versionId = existing.versionId;
  } else {
    const { version } = await getFormForEntry(actor, input.formId);
    versionId = version.id;
  }

  const version = await prisma.formVersion.findUniqueOrThrow({
    where: { id: versionId },
    include: { fields: { orderBy: { order: "asc" } }, rules: true, form: true },
  });
  const fields = version.fields.map(toFieldDef);
  const rules = toRuleDefs(version.rules);
  const result = validateSubmission(fields, rules, input.values as RawValues);

  if (result.hasFormatErrors || (input.intent === "submit" && result.hasBlockingErrors)) {
    const fieldErrors: Record<string, string[]> = {};
    for (const i of result.issues.filter((x) => x.severity === "ERREUR")) {
      (fieldErrors[i.fieldKey ?? "_form"] ??= []).push(i.message);
    }
    const n = result.issues.filter((x) => x.severity === "ERREUR").length;
    throw new ValidationError(
      input.intent === "submit"
        ? `La réponse ne peut pas être soumise : ${n} erreur${n > 1 ? "s" : ""} à corriger.`
        : "Certaines valeurs ont un format invalide et ne peuvent pas être enregistrées.",
      fieldErrors,
      result.issues,
    );
  }

  const duplicateKey = computeDuplicateKey(version.form.duplicateFieldKeys, result.values);
  const now = new Date();
  const nextStatus: SubmissionStatus =
    input.intent === "submit" ? "SOUMISE" : existing ? existing.status : "BROUILLON";

  const saved = await prisma.$transaction(async (tx) => {
    const data = {
      status: nextStatus,
      completeness: result.completeness,
      duplicateKey,
      ...(input.intent === "submit" ? { submittedAt: now, reviewedById: null, reviewedAt: null } : {}),
    };
    let sub;
    if (existing) {
      sub = await tx.submission.update({ where: { id: existing.id }, data });
    } else {
      sub = await tx.submission.create({
        data: { ...data, reference: newReference(now), versionId, formId: version.formId, agentId: actor.id },
      });
    }
    await tx.submissionValue.deleteMany({ where: { submissionId: sub.id } });
    const rows = version.fields
      .filter((f) => result.values[f.key] !== null && result.values[f.key] !== undefined)
      .map((f) => {
        const cols = toValueColumns(f, result.values[f.key]);
        return {
          submissionId: sub.id,
          fieldId: f.id,
          valueText: cols.valueText,
          valueNumber: cols.valueNumber === null ? null : new Prisma.Decimal(cols.valueNumber),
          valueDate: cols.valueDate,
          valueBool: cols.valueBool,
          valueJson: cols.valueJson ?? Prisma.JsonNull,
        };
      });
    if (rows.length) await tx.submissionValue.createMany({ data: rows });

    const duplicates = nextStatus === "BROUILLON" ? [] : await findDuplicates(tx, version.formId, duplicateKey, sub.id);
    await persistIssues(tx, sub.id, fields, result.issues, duplicates);

    await audit(
      {
        actorId: actor.id,
        action: input.intent === "submit" ? "submission.submit" : existing ? "submission.update" : "submission.create",
        entityType: "Submission",
        entityId: sub.id,
        metadata: { reference: sub.reference, status: nextStatus, completeness: result.completeness, warnings: result.issues.filter((i) => i.severity === "AVERTISSEMENT").length + duplicates.length },
      },
      tx,
    );
    return sub;
  });

  return {
    submission: saved,
    warnings: result.issues.filter((i) => i.severity === "AVERTISSEMENT"),
    issues: result.issues,
  };
}

const reviewSchema = z.object({
  decision: z.enum(["VALIDER", "REJETER", "A_CORRIGER"]),
  comment: z.string().trim().max(1000).optional(),
});

/** Validation, rejet ou renvoi pour correction par un superviseur / administrateur */
export async function reviewSubmission(actor: SessionUser, submissionId: string, input: { decision: string; comment?: string }) {
  assertCan(actor, "submission:review");
  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError("Décision invalide.");
  const { decision, comment } = parsed.data;
  if (decision !== "VALIDER" && !comment) {
    throw new ValidationError("Un commentaire est obligatoire pour rejeter ou renvoyer une réponse.", { comment: ["Commentaire obligatoire."] });
  }
  const sub = await prisma.submission.findFirst({ where: { AND: [{ id: submissionId }, submissionScope(actor)] } });
  if (!sub) throw new NotFoundError("Réponse introuvable ou inaccessible.");
  if (sub.agentId === actor.id) throw new ForbiddenError("Vous ne pouvez pas valider votre propre réponse.");
  if (sub.status !== "SOUMISE") throw new AppError("Seules les réponses en attente de validation peuvent être traitées.");

  const status: SubmissionStatus = decision === "VALIDER" ? "VALIDEE" : decision === "REJETER" ? "REJETEE" : "A_CORRIGER";
  const action = decision === "VALIDER" ? "submission.validate" : decision === "REJETER" ? "submission.reject" : "submission.return";
  return prisma.$transaction(async (tx) => {
    // mise à jour conditionnelle : évite qu'une double validation simultanée écrase un autre statut
    const res = await tx.submission.updateMany({
      where: { id: sub.id, status: "SOUMISE" },
      data: { status, reviewedById: actor.id, reviewedAt: new Date(), reviewComment: comment || null },
    });
    if (res.count !== 1) throw new AppError("Cette réponse vient d'être traitée par un autre utilisateur.");
    await audit({ actorId: actor.id, action, entityType: "Submission", entityId: sub.id, metadata: { reference: sub.reference, comment: comment ?? null } }, tx);
    return status;
  });
}

export const SUBMISSION_STATUSES: SubmissionStatus[] = ["BROUILLON", "SOUMISE", "A_CORRIGER", "VALIDEE", "REJETEE"];

export type SubmissionFilters = {
  q?: string;
  formId?: string;
  status?: string;
  from?: string; // AAAA-MM-JJ
  to?: string;
  agentId?: string;
  hasIssues?: string; // "1"
};

const dateRe = /^\d{4}-\d{2}-\d{2}$/;

export function buildSubmissionWhere(actor: SessionUser, f: SubmissionFilters): Prisma.SubmissionWhereInput {
  const and: Prisma.SubmissionWhereInput[] = [submissionScope(actor)];
  if (f.formId) and.push({ formId: f.formId });
  if (f.status && SUBMISSION_STATUSES.includes(f.status as SubmissionStatus)) and.push({ status: f.status as SubmissionStatus });
  if (f.agentId) and.push({ agentId: f.agentId });
  if (f.from && dateRe.test(f.from)) and.push({ createdAt: { gte: new Date(`${f.from}T00:00:00.000Z`) } });
  if (f.to && dateRe.test(f.to)) and.push({ createdAt: { lt: new Date(new Date(`${f.to}T00:00:00.000Z`).getTime() + 86400_000) } });
  if (f.hasIssues === "1") and.push({ issues: { some: {} } });
  const q = f.q?.trim().slice(0, 100);
  if (q) {
    and.push({
      OR: [
        { reference: { contains: q, mode: "insensitive" } },
        { agent: { name: { contains: q, mode: "insensitive" } } },
        { values: { some: { valueText: { contains: q, mode: "insensitive" } } } },
      ],
    });
  }
  return { AND: and };
}

export async function listSubmissions(actor: SessionUser, filters: SubmissionFilters, page = 1, pageSize = 20) {
  if (!can(actor, "submission:view_all") && !can(actor, "submission:view_scope") && !can(actor, "submission:view_own")) {
    throw new ForbiddenError();
  }
  const where = buildSubmissionWhere(actor, filters);
  const safePage = Math.max(1, Math.min(page, 10_000));
  const [total, rows] = await Promise.all([
    prisma.submission.count({ where }),
    prisma.submission.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (safePage - 1) * pageSize,
      take: pageSize,
      include: {
        agent: { select: { name: true } },
        version: { select: { number: true, form: { select: { code: true, title: true } } } },
        _count: { select: { issues: true } },
        issues: { select: { severity: true } },
      },
    }),
  ]);
  return {
    total,
    page: safePage,
    pageSize,
    rows: rows.map((r) => ({
      id: r.id,
      reference: r.reference,
      status: r.status,
      formTitle: r.version.form.title,
      formCode: r.version.form.code,
      versionNumber: r.version.number,
      agentName: r.agent.name,
      completeness: r.completeness,
      createdAt: r.createdAt,
      submittedAt: r.submittedAt,
      errorCount: r.issues.filter((i) => i.severity === "ERREUR").length,
      warningCount: r.issues.filter((i) => i.severity === "AVERTISSEMENT").length,
    })),
  };
}

export async function getSubmissionDetail(actor: SessionUser, submissionId: string) {
  const sub = await prisma.submission.findFirst({
    where: { AND: [{ id: submissionId }, submissionScope(actor)] },
    include: {
      agent: { select: { id: true, name: true, email: true } },
      reviewedBy: { select: { name: true } },
      values: true,
      issues: { include: { field: { select: { key: true, label: true } } }, orderBy: [{ severity: "asc" }, { createdAt: "asc" }] },
      version: { include: { form: true, fields: { orderBy: { order: "asc" } }, rules: true } },
    },
  });
  if (!sub) throw new NotFoundError("Réponse introuvable ou inaccessible.");
  const history = await prisma.auditLog.findMany({
    where: { entityType: "Submission", entityId: sub.id },
    orderBy: { createdAt: "asc" },
    include: { actor: { select: { name: true } } },
  });
  const fields = sub.version.fields.map(toFieldDef);
  return {
    submission: sub,
    form: sub.version.form,
    fields,
    rules: toRuleDefs(sub.version.rules),
    values: valuesByKey(sub.version.fields, sub.values),
    history,
    canEdit: canEditSubmission(actor, sub, sub.version.form.status),
    canReview: can(actor, "submission:review") && sub.status === "SOUMISE" && sub.agentId !== actor.id,
  };
}
