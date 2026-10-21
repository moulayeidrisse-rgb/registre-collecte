import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { IssueType, SubmissionStatus } from "@/generated/prisma/enums";
import { prisma } from "../db";
import { assertCan, formScope, submissionScope, type SessionUser } from "../auth/permissions";

export type DashboardData = Awaited<ReturnType<typeof getDashboard>>;

/** Indicateurs calculés à partir des données enregistrées, restreints au périmètre de l'acteur */
export async function getDashboard(actor: SessionUser, opts: { days?: number; now?: Date } = {}) {
  assertCan(actor, "dashboard:view");
  const days = opts.days ?? 30;
  const now = opts.now ?? new Date();
  const scope = submissionScope(actor);
  const nonDraft: Prisma.SubmissionWhereInput = { AND: [scope, { status: { not: "BROUILLON" } }] };

  const formWhere: Prisma.FormWhereInput =
    actor.role === "ADMIN" ? {} : { AND: [formScope(actor), { status: { not: "BROUILLON" } }] };

  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - (days - 1)));

  const [formsByStatus, byStatus, completeness, recent, byForm, issuesByType, latestIssues] = await Promise.all([
    prisma.form.groupBy({ by: ["status"], where: formWhere, _count: { _all: true } }),
    prisma.submission.groupBy({ by: ["status"], where: scope, _count: { _all: true } }),
    prisma.submission.aggregate({ where: nonDraft, _avg: { completeness: true } }),
    prisma.submission.findMany({
      where: { AND: [nonDraft, { submittedAt: { gte: start } }] },
      select: { submittedAt: true, status: true },
    }),
    prisma.submission.groupBy({ by: ["formId", "status"], where: scope, _count: { _all: true } }),
    prisma.qualityIssue.groupBy({
      by: ["type", "severity"],
      where: { submission: { AND: [scope, { status: { notIn: ["REJETEE"] } }] } },
      _count: { _all: true },
    }),
    prisma.submission.findMany({
      where: { AND: [scope, { status: { notIn: ["VALIDEE", "REJETEE"] } }, { issues: { some: {} } }] },
      orderBy: { updatedAt: "desc" },
      take: 4,
      select: {
        id: true,
        reference: true,
        status: true,
        version: { select: { form: { select: { title: true } } } },
        agent: { select: { name: true } },
        issues: { select: { type: true, severity: true, message: true }, take: 3 },
        _count: { select: { issues: true } },
      },
    }),
  ]);

  const statusCount = (s: SubmissionStatus) => byStatus.find((b) => b.status === s)?._count._all ?? 0;
  const totalAll = byStatus.reduce((a, b) => a + b._count._all, 0);
  const drafts = statusCount("BROUILLON");

  // Série temporelle quotidienne (UTC)
  const series: { date: string; soumises: number; validees: number }[] = [];
  const idx = new Map<string, number>();
  for (let i = 0; i < days; i++) {
    const d = new Date(start.getTime() + i * 86400_000).toISOString().slice(0, 10);
    idx.set(d, series.length);
    series.push({ date: d, soumises: 0, validees: 0 });
  }
  for (const r of recent) {
    if (!r.submittedAt) continue;
    const i = idx.get(r.submittedAt.toISOString().slice(0, 10));
    if (i === undefined) continue;
    series[i].soumises++;
    if (r.status === "VALIDEE") series[i].validees++;
  }

  // Répartition par formulaire
  const formIds = [...new Set(byForm.map((b) => b.formId))];
  const forms = await prisma.form.findMany({ where: { id: { in: formIds } }, select: { id: true, title: true, code: true } });
  const perForm = forms
    .map((f) => {
      const rows = byForm.filter((b) => b.formId === f.id);
      const get = (s: SubmissionStatus) => rows.find((r) => r.status === s)?._count._all ?? 0;
      return {
        formId: f.id,
        code: f.code,
        title: f.title,
        validees: get("VALIDEE"),
        enAttente: get("SOUMISE"),
        aCorriger: get("A_CORRIGER"),
        rejetees: get("REJETEE"),
        brouillons: get("BROUILLON"),
        total: rows.reduce((a, r) => a + r._count._all, 0),
      };
    })
    .sort((a, b) => b.total - a.total);

  const issueTotals: Record<IssueType, { erreurs: number; avertissements: number }> = {
    MANQUANT: { erreurs: 0, avertissements: 0 },
    HORS_PLAGE: { erreurs: 0, avertissements: 0 },
    FORMAT: { erreurs: 0, avertissements: 0 },
    DOUBLON: { erreurs: 0, avertissements: 0 },
    INCOHERENCE: { erreurs: 0, avertissements: 0 },
  };
  for (const i of issuesByType) {
    if (i.severity === "ERREUR") issueTotals[i.type].erreurs += i._count._all;
    else issueTotals[i.type].avertissements += i._count._all;
  }

  return {
    forms: {
      total: formsByStatus.reduce((a, b) => a + b._count._all, 0),
      publies: formsByStatus.find((f) => f.status === "PUBLIE")?._count._all ?? 0,
      brouillons: formsByStatus.find((f) => f.status === "BROUILLON")?._count._all ?? 0,
      desactives: formsByStatus.find((f) => f.status === "DESACTIVE")?._count._all ?? 0,
    },
    submissions: {
      total: totalAll,
      enregistrees: totalAll - drafts,
      brouillons: drafts,
      enAttente: statusCount("SOUMISE"),
      validees: statusCount("VALIDEE"),
      aCorriger: statusCount("A_CORRIGER"),
      rejetees: statusCount("REJETEE"),
    },
    completenessAvg: completeness._avg.completeness === null ? null : Math.round(completeness._avg.completeness * 10) / 10,
    series,
    perForm,
    issueTotals,
    issueCount: issuesByType.reduce((a, b) => a + b._count._all, 0),
    latestIssues: latestIssues.map((s) => ({
      id: s.id,
      reference: s.reference,
      status: s.status,
      formTitle: s.version.form.title,
      agentName: s.agent.name,
      issueCount: s._count.issues,
      issues: s.issues,
    })),
    periodDays: days,
  };
}
