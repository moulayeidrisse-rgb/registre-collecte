import "server-only";
import { randomBytes } from "node:crypto";
import type { Tx } from "../db";
import { prisma } from "../db";
import { sha256 } from "../auth/tokens";
import { assertCan, type SessionUser } from "../auth/permissions";
import { duplicateSignature, validateSubmission } from "@/lib/validation/engine";
import type { FieldDef, RuleDef, TypedValues, ValidationIssue } from "@/lib/validation/types";
import { toFieldDef, toRuleDefs, valuesByKey } from "./mappers";
import { audit } from "./audit";

export function computeDuplicateKey(keys: string[], values: TypedValues): string | null {
  const sig = duplicateSignature(keys, values);
  return sig ? sha256(sig) : null;
}

export function newReference(now = new Date()) {
  return `R-${now.getUTCFullYear()}-${randomBytes(4).toString("hex").toUpperCase()}`;
}

/**
 * Recherche les doublons potentiels : autres réponses non brouillon, non rejetées,
 * du même formulaire et de même empreinte.
 */
export async function findDuplicates(tx: Tx | typeof prisma, formId: string, duplicateKey: string | null, excludeId?: string) {
  if (!duplicateKey) return [];
  return tx.submission.findMany({
    where: {
      formId,
      duplicateKey,
      status: { notIn: ["BROUILLON", "REJETEE"] },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { id: true, reference: true },
    orderBy: { createdAt: "asc" },
    take: 5,
  });
}

/** Remplace les anomalies enregistrées d'une réponse */
export async function persistIssues(
  tx: Tx,
  submissionId: string,
  fields: FieldDef[],
  issues: ValidationIssue[],
  duplicates: { id: string; reference: string }[],
) {
  const idByKey = new Map(fields.map((f) => [f.key, f.id]));
  await tx.qualityIssue.deleteMany({ where: { submissionId } });
  const rows = [
    ...issues.map((i) => ({
      submissionId,
      fieldId: i.fieldKey ? idByKey.get(i.fieldKey) ?? null : null,
      type: i.type,
      severity: i.severity,
      message: i.message,
    })),
    ...duplicates.map((d) => ({
      submissionId,
      fieldId: null,
      type: "DOUBLON" as const,
      severity: "AVERTISSEMENT" as const,
      message: `Doublon potentiel : mêmes valeurs que la réponse ${d.reference} sur les critères de dédoublonnage.`,
      relatedSubmissionId: d.id,
    })),
  ];
  if (rows.length) await tx.qualityIssue.createMany({ data: rows });
}

/** Relance le contrôle qualité sur toutes les réponses d'un formulaire (après changement de règles) */
export async function rescanForm(actor: SessionUser, formId: string) {
  assertCan(actor, "quality:rescan");
  const form = await prisma.form.findUniqueOrThrow({ where: { id: formId } });
  const submissions = await prisma.submission.findMany({
    where: { formId },
    include: { values: true, version: { include: { fields: true, rules: true } } },
    orderBy: { createdAt: "asc" },
  });
  let updated = 0;
  for (const s of submissions) {
    const fields: FieldDef[] = s.version.fields.map(toFieldDef);
    const rules: RuleDef[] = toRuleDefs(s.version.rules);
    const typed = valuesByKey(s.version.fields, s.values);
    const result = validateSubmission(fields, rules, typed);
    const duplicateKey = computeDuplicateKey(form.duplicateFieldKeys, result.values);
    await prisma.$transaction(async (tx) => {
      await tx.submission.update({ where: { id: s.id }, data: { duplicateKey, completeness: result.completeness } });
      const dups = s.status === "BROUILLON" ? [] : await findDuplicates(tx, formId, duplicateKey, s.id);
      // seules les réponses plus récentes sont signalées comme doublon d'une plus ancienne
      const older = dups.filter((d) => submissions.findIndex((x) => x.id === d.id) < submissions.findIndex((x) => x.id === s.id));
      await persistIssues(tx, s.id, fields, result.issues, older);
    });
    updated++;
  }
  await audit({ actorId: actor.id, action: "quality.rescan", entityType: "Form", entityId: formId, metadata: { submissions: updated } });
  return updated;
}
