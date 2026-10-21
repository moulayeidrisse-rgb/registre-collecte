import "server-only";
import { prisma } from "../db";
import { assertCan, type SessionUser } from "../auth/permissions";
import { NotFoundError } from "../errors";
import { toCsv } from "@/lib/csv";
import { SUBMISSION_STATUS_LABELS } from "@/lib/labels";
import { buildSubmissionWhere, type SubmissionFilters } from "./submissions";
import { displayValue, fromValueColumns } from "./mappers";
import { audit } from "./audit";
import type { FieldOption } from "@/lib/validation/types";

export const EXPORT_MAX_ROWS = 50_000;

/**
 * Export CSV des réponses d'un formulaire, restreint au périmètre de l'acteur.
 * Les colonnes de questions suivent la version la plus récente ; les valeurs sont appariées par clé.
 */
export async function exportSubmissionsCsv(actor: SessionUser, filters: SubmissionFilters & { formId: string }, ipAddress?: string | null) {
  assertCan(actor, "export:csv");
  const form = await prisma.form.findFirst({
    where: { id: filters.formId, ...(actor.role === "ADMIN" ? {} : { assignments: { some: { userId: actor.id } } }) },
    include: { versions: { orderBy: { number: "desc" }, include: { fields: { orderBy: { order: "asc" } } } } },
  });
  if (!form) throw new NotFoundError("Formulaire introuvable ou inaccessible.");

  // Union des champs de toutes les versions (ordre de la plus récente, puis champs retirés)
  const fieldByKey = new Map<string, { key: string; label: string; type: (typeof form.versions)[number]["fields"][number]["type"]; options: FieldOption[] | null }>();
  for (const v of form.versions) {
    for (const f of v.fields) {
      if (!fieldByKey.has(f.key)) fieldByKey.set(f.key, { key: f.key, label: f.label, type: f.type, options: (f.options as FieldOption[] | null) ?? null });
    }
  }
  const fields = [...fieldByKey.values()];

  const where = buildSubmissionWhere(actor, filters);
  const subs = await prisma.submission.findMany({
    where,
    orderBy: { createdAt: "asc" },
    take: EXPORT_MAX_ROWS,
    include: {
      agent: { select: { name: true } },
      reviewedBy: { select: { name: true } },
      version: { select: { number: true } },
      values: { include: { field: { select: { key: true, type: true } } } },
      _count: { select: { issues: true } },
    },
  });

  const header = [
    "Référence",
    "Statut",
    "Version",
    "Agent",
    "Créée le",
    "Soumise le",
    "Traitée par",
    "Complétude (%)",
    "Anomalies",
    ...fields.map((f) => `${f.label} [${f.key}]`),
  ];
  const rows = subs.map((s) => {
    const byKey = new Map(s.values.map((v) => [v.field.key, fromValueColumns(v.field.type, v)]));
    return [
      s.reference,
      SUBMISSION_STATUS_LABELS[s.status],
      s.version.number,
      s.agent.name,
      s.createdAt.toISOString(),
      s.submittedAt?.toISOString() ?? "",
      s.reviewedBy?.name ?? "",
      s.completeness,
      s._count.issues,
      ...fields.map((f) => displayValue(f, byKey.get(f.key) ?? null)),
    ];
  });

  await audit({
    actorId: actor.id,
    action: "export.csv",
    entityType: "Form",
    entityId: form.id,
    metadata: { rows: rows.length, filters: { status: filters.status ?? null, from: filters.from ?? null, to: filters.to ?? null, q: filters.q ?? null } },
    ipAddress,
  });

  const date = new Date().toISOString().slice(0, 10);
  return { filename: `export_${form.code}_${date}.csv`, content: toCsv(header, rows), rowCount: rows.length };
}
