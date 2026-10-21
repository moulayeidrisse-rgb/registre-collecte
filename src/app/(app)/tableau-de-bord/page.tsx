import Link from "next/link";
import { AlertTriangle, CheckCircle2, Clock, FileText, Gauge, Inbox, RotateCcw } from "lucide-react";
import { requirePagePermission } from "@/server/auth/session";
import { can } from "@/server/auth/permissions";
import { getDashboard } from "@/server/services/dashboard";
import { Badge, ButtonLink, Card, CardHeader, EmptyState, PageHeader, StatCard, Table, Td, Th } from "@/components/ui";
import { SubmissionStatusBadge } from "@/components/status";
import { PerFormChart, TimelineChart } from "@/components/charts/dashboard-charts";
import { ISSUE_TYPE_LABELS } from "@/lib/labels";
import { formatNumber, formatPercent } from "@/lib/format";
import type { IssueType } from "@/generated/prisma/enums";
import { getT } from "@/i18n/server";

export async function generateMetadata() {
  return { title: (await getT())("Tableau de bord") };
}

export default async function DashboardPage() {
  const user = await requirePagePermission("dashboard:view");
  const t = await getT();
  const L = t.locale;
  const d = await getDashboard(user);
  const scopeLabel =
    user.role === "ADMIN" ? t("toutes les données") : user.role === "SUPERVISEUR" ? t("formulaires dont vous assurez le suivi") : t("vos propres saisies");
  const hasData = d.submissions.total > 0;

  return (
    <>
      <PageHeader
        t={t}
        title={t("Tableau de bord")}
        description={t("Indicateurs calculés en temps réel à partir des réponses enregistrées. Périmètre : {scope}.", { scope: scopeLabel })}
        actions={
          can(user, "submission:create") ? <ButtonLink href="/collecte">{t("Nouvelle saisie")}</ButtonLink> : can(user, "submission:review") ? <ButtonLink href="/reponses?status=SOUMISE">{t("Réponses à valider")}</ButtonLink> : null
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label={t("Formulaires")} value={formatNumber(d.forms.total, L)} hint={t("{a} publié(s) · {b} brouillon(s) · {c} désactivé(s)", { a: d.forms.publies, b: d.forms.brouillons, c: d.forms.desactives })} icon={<FileText className="h-5 w-5" />} />
        <StatCard label={t("Réponses enregistrées")} value={formatNumber(d.submissions.enregistrees, L)} hint={t("hors {n} brouillon(s)", { n: d.submissions.brouillons })} icon={<Inbox className="h-5 w-5" />} />
        <StatCard label={t("Réponses validées")} value={formatNumber(d.submissions.validees, L)} tone="success" hint={d.submissions.enregistrees ? t("{p} des réponses enregistrées", { p: formatPercent((d.submissions.validees / d.submissions.enregistrees) * 100, L) }) : "—"} icon={<CheckCircle2 className="h-5 w-5" />} />
        <StatCard label={t("En attente de validation")} value={formatNumber(d.submissions.enAttente, L)} tone="info" hint={t("{a} à corriger · {b} rejetée(s)", { a: d.submissions.aCorriger, b: d.submissions.rejetees })} icon={<Clock className="h-5 w-5" />} />
        <StatCard label={t("Taux de complétude moyen")} value={formatPercent(d.completenessAvg, L)} hint={t("Questions renseignées / questions du formulaire (réponses enregistrées)")} icon={<Gauge className="h-5 w-5" />} />
        <StatCard label={t("Anomalies détectées")} value={formatNumber(d.issueCount, L)} tone={d.issueCount ? "warning" : "neutral"} hint={t("Erreurs et avertissements en cours")} icon={<AlertTriangle className="h-5 w-5" />} />
        <StatCard label={t("À corriger")} value={formatNumber(d.submissions.aCorriger, L)} tone={d.submissions.aCorriger ? "warning" : "neutral"} hint={t("Renvoyées par un superviseur")} icon={<RotateCcw className="h-5 w-5" />} />
        <StatCard label={t("Brouillons")} value={formatNumber(d.submissions.brouillons, L)} hint={t("Saisies non soumises")} icon={<FileText className="h-5 w-5" />} />
      </div>

      {!hasData ? (
        <Card className="mt-6">
          <EmptyState title={t("Aucune réponse enregistrée pour l'instant")} description={t("Les graphiques s'afficheront dès les premières saisies.")} action={can(user, "submission:create") ? <ButtonLink href="/collecte">{t("Commencer une saisie")}</ButtonLink> : undefined} />
        </Card>
      ) : (
        <div className="mt-6 grid items-start gap-6 xl:grid-cols-5">
          <Card className="xl:col-span-3">
            <CardHeader title={t("Évolution des collectes")} description={t("Réponses soumises par jour, {n} derniers jours (date de soumission)", { n: d.periodDays })} />
            <div className="p-4">
              <TimelineChart data={d.series} />
              <details className="mt-2 text-sm">
                <summary className="cursor-pointer text-primary-700">{t("Afficher les données sous forme de tableau")}</summary>
                <Table caption={t("Réponses par jour")}>
                  <thead><tr><Th>{t("Date")}</Th><Th className="text-end">{t("Soumises")}</Th><Th className="text-end">{t("dont validées")}</Th></tr></thead>
                  <tbody className="divide-y divide-line">
                    {d.series.filter((s) => s.soumises > 0).map((s) => (
                      <tr key={s.date}><Td>{s.date.split("-").reverse().join("/")}</Td><Td className="text-end tabular-nums">{s.soumises}</Td><Td className="text-end tabular-nums">{s.validees}</Td></tr>
                    ))}
                  </tbody>
                </Table>
              </details>
            </div>
          </Card>

          <Card className="xl:col-span-2">
            <CardHeader title={t("Alertes qualité")} description={t("Anomalies en cours sur les réponses non rejetées")} actions={can(user, "quality:view") ? <ButtonLink href="/qualite" variant="secondary" size="sm">{t("Tout voir")}</ButtonLink> : undefined} />
            <ul className="divide-y divide-line">
              {(Object.keys(d.issueTotals) as IssueType[]).map((k) => {
                const v = d.issueTotals[k];
                return (
                  <li key={k} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                    <span>{t(ISSUE_TYPE_LABELS[k])}</span>
                    <span className="flex gap-1.5">
                      {v.erreurs > 0 && <Badge tone="danger">{t("{n} erreur(s)", { n: v.erreurs })}</Badge>}
                      {v.avertissements > 0 && <Badge tone="warning">{t("{n} avert.", { n: v.avertissements })}</Badge>}
                      {v.erreurs + v.avertissements === 0 && <span className="text-muted">0</span>}
                    </span>
                  </li>
                );
              })}
            </ul>
            {d.latestIssues.length > 0 && (
              <div className="border-t border-line px-5 py-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{t("Réponses récentes à examiner")}</p>
                <ul className="space-y-2.5">
                  {d.latestIssues.map((s) => (
                    <li key={s.id} className="text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link href={`/reponses/${s.id}`} className="font-medium text-primary-700 hover:underline">{s.reference}</Link>
                        <SubmissionStatusBadge status={s.status} t={t} />
                      </div>
                      <p className="text-xs text-muted">{s.formTitle} · {s.agentName} · {t("{n} anomalie(s)", { n: s.issueCount })}</p>
                      <p className="mt-0.5 line-clamp-2 text-xs text-ink">{t.msg(s.issues[0]?.message ?? "")}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>

          <Card className="xl:col-span-5">
            <CardHeader title={t("Répartition des réponses par formulaire")} description={t("Par statut ; les brouillons sont indiqués dans le tableau")} />
            <div className="grid gap-4 p-4">
              <PerFormChart data={d.perForm} />
              <Table caption={t("Réponses par formulaire")}>
                <thead><tr><Th>{t("Formulaire")}</Th><Th className="text-end">{t("Validées")}</Th><Th className="text-end">{t("En attente")}</Th><Th className="text-end">{t("À corriger")}</Th><Th className="text-end">{t("Rejetées")}</Th><Th className="text-end">{t("Brouillons")}</Th></tr></thead>
                <tbody className="divide-y divide-line">
                  {d.perForm.map((f) => (
                    <tr key={f.formId}>
                      <Td><span className="font-medium">{f.code}</span><span className="block text-xs text-muted">{f.title}</span></Td>
                      <Td className="text-end tabular-nums">{f.validees}</Td>
                      <Td className="text-end tabular-nums">{f.enAttente}</Td>
                      <Td className="text-end tabular-nums">{f.aCorriger}</Td>
                      <Td className="text-end tabular-nums">{f.rejetees}</Td>
                      <Td className="text-end tabular-nums text-muted">{f.brouillons}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
