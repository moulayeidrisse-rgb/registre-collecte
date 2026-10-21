import "server-only";
import type { FieldType } from "@/generated/prisma/enums";
import { prisma } from "../db";
import { assertCan, type SessionUser } from "../auth/permissions";
import { NotFoundError } from "../errors";
import { buildSubmissionWhere, type SubmissionFilters } from "./submissions";
import { fromValueColumns } from "./mappers";
import type { FieldOption } from "@/lib/validation/types";

export type FieldStat =
  | { key: string; label: string; type: FieldType; kind: "numeric"; answered: number; min: number | null; max: number | null; mean: number | null; median: number | null }
  | { key: string; label: string; type: FieldType; kind: "distribution"; answered: number; distribution: { label: string; count: number; percent: number }[] }
  | { key: string; label: string; type: FieldType; kind: "text"; answered: number; distinct: number }
  | { key: string; label: string; type: FieldType; kind: "date"; answered: number; min: string | null; max: string | null };

/** Rapport simple sur un formulaire : statuts, complétude, statistiques par question */
export async function getFormReport(actor: SessionUser, formId: string, filters: Omit<SubmissionFilters, "formId"> = {}) {
  assertCan(actor, "report:view");
  const where = buildSubmissionWhere(actor, { ...filters, formId });
  const form = await prisma.form.findFirst({
    where: { id: formId, ...(actor.role === "ADMIN" ? {} : { assignments: { some: { userId: actor.id } } }) },
    include: { versions: { orderBy: { number: "desc" }, include: { fields: { orderBy: { order: "asc" } } } } },
  });
  if (!form) throw new NotFoundError("Formulaire introuvable ou inaccessible.");

  // Statistiques calculées sur les réponses non brouillon et non rejetées
  const statsWhere = { AND: [where, { status: { notIn: ["BROUILLON", "REJETEE"] as ("BROUILLON" | "REJETEE")[] } }] };
  const [byStatus, agg, subs] = await Promise.all([
    prisma.submission.groupBy({ by: ["status"], where, _count: { _all: true } }),
    prisma.submission.aggregate({ where: statsWhere, _avg: { completeness: true }, _count: { _all: true } }),
    prisma.submission.findMany({ where: statsWhere, select: { id: true, values: { include: { field: { select: { key: true, type: true } } } } } }),
  ]);

  // Champs de référence : version la plus récente (publiée ou archivée), appariés par clé
  const refVersion = form.versions.find((v) => v.status === "PUBLIEE") ?? form.versions.find((v) => v.status !== "BROUILLON") ?? form.versions[0];
  const fields = refVersion?.fields ?? [];

  const valuesByKey = new Map<string, unknown[]>();
  for (const s of subs) {
    for (const v of s.values) {
      const tv = fromValueColumns(v.field.type, v);
      if (tv === null) continue;
      const arr = valuesByKey.get(v.field.key) ?? [];
      arr.push(tv);
      valuesByKey.set(v.field.key, arr);
    }
  }

  const stats: FieldStat[] = fields.map((f) => {
    const vals = valuesByKey.get(f.key) ?? [];
    const base = { key: f.key, label: f.label, type: f.type, answered: vals.length };
    const opts = (f.options as FieldOption[] | null) ?? [];
    switch (f.type) {
      case "NOMBRE": {
        const nums = (vals as number[]).slice().sort((a, b) => a - b);
        const mean = nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
        const median = nums.length ? (nums.length % 2 ? nums[(nums.length - 1) / 2] : (nums[nums.length / 2 - 1] + nums[nums.length / 2]) / 2) : null;
        return { ...base, kind: "numeric", min: nums[0] ?? null, max: nums.at(-1) ?? null, mean, median };
      }
      case "DATE": {
        const ds = (vals as string[]).slice().sort();
        return { ...base, kind: "date", min: ds[0] ?? null, max: ds.at(-1) ?? null };
      }
      case "OUI_NON": {
        const yes = (vals as boolean[]).filter(Boolean).length;
        const n = vals.length || 1;
        return {
          ...base,
          kind: "distribution",
          distribution: [
            { label: "Oui", count: yes, percent: Math.round((yes / n) * 1000) / 10 },
            { label: "Non", count: vals.length - yes, percent: Math.round(((vals.length - yes) / n) * 1000) / 10 },
          ],
        };
      }
      case "LISTE":
      case "CHOIX_UNIQUE":
      case "CHOIX_MULTIPLE": {
        const counts = new Map<string, number>();
        for (const v of vals) for (const x of Array.isArray(v) ? v : [v]) counts.set(String(x), (counts.get(String(x)) ?? 0) + 1);
        const n = vals.length || 1;
        const known = opts.map((o) => ({ label: o.label, count: counts.get(o.value) ?? 0 }));
        const unknown = [...counts.entries()].filter(([k]) => !opts.some((o) => o.value === k)).map(([k, c]) => ({ label: `${k} (option retirée)`, count: c }));
        return {
          ...base,
          kind: "distribution",
          distribution: [...known, ...unknown].map((d) => ({ ...d, percent: Math.round((d.count / n) * 1000) / 10 })),
        };
      }
      default:
        return { ...base, kind: "text", distinct: new Set(vals.map((v) => String(v).toLowerCase())).size };
    }
  });

  const total = byStatus.reduce((a, b) => a + b._count._all, 0);
  return {
    form: { id: form.id, code: form.code, title: form.title, status: form.status },
    statusCounts: Object.fromEntries(byStatus.map((b) => [b.status, b._count._all])) as Record<string, number>,
    total,
    analysed: agg._count._all,
    completenessAvg: agg._avg.completeness,
    stats,
  };
}
