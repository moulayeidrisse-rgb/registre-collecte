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

export const metadata = { title: "Tableau de bord" };

export default async function DashboardPage() {
  const user = await requirePagePermission("dashboard:view");
  const d = await getDashboard(user);
  const scopeLabel =
    user.role === "ADMIN" ? "Toutes les données" : user.role === "SUPERVISEUR" ? "Formulaires dont vous assurez le suivi" : "Vos propres saisies";
  const hasData = d.submissions.total > 0;

  return (
    <>
      <PageHeader
        title="Tableau de bord"
        description={`Indicateurs calculés en temps réel à partir des réponses enregistrées. Périmètre : ${scopeLabel.toLowerCase()}.`}
        actions={
          can(user, "submission:create") ? <ButtonLink href="/collecte">Nouvelle saisie</ButtonLink> : can(user, "submission:review") ? <ButtonLink href="/reponses?status=SOUMISE">Réponses à valider</ButtonLink> : null
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Formulaires" value={formatNumber(d.forms.total)} hint={`${d.forms.publies} publié(s) · ${d.forms.brouillons} brouillon(s) · ${d.forms.desactives} désactivé(s)`} icon={<FileText className="h-5 w-5" />} />
        <StatCard label="Réponses enregistrées" value={formatNumber(d.submissions.enregistrees)} hint={`hors ${d.submissions.brouillons} brouillon(s)`} icon={<Inbox className="h-5 w-5" />} />
        <StatCard label="Réponses validées" value={formatNumber(d.submissions.validees)} tone="success" hint={d.submissions.enregistrees ? `${formatPercent((d.submissions.validees / d.submissions.enregistrees) * 100)} des réponses enregistrées` : "—"} icon={<CheckCircle2 className="h-5 w-5" />} />
        <StatCard label="En attente de validation" value={formatNumber(d.submissions.enAttente)} tone="info" hint={`${d.submissions.aCorriger} à corriger · ${d.submissions.rejetees} rejetée(s)`} icon={<Clock className="h-5 w-5" />} />
        <StatCard label="Taux de complétude moyen" value={formatPercent(d.completenessAvg)} hint="Questions renseignées / questions du formulaire (réponses enregistrées)" icon={<Gauge className="h-5 w-5" />} />
        <StatCard label="Anomalies détectées" value={formatNumber(d.issueCount)} tone={d.issueCount ? "warning" : "neutral"} hint="Erreurs et avertissements en cours" icon={<AlertTriangle className="h-5 w-5" />} />
        <StatCard label="À corriger" value={formatNumber(d.submissions.aCorriger)} tone={d.submissions.aCorriger ? "warning" : "neutral"} hint="Renvoyées par un superviseur" icon={<RotateCcw className="h-5 w-5" />} />
        <StatCard label="Brouillons" value={formatNumber(d.submissions.brouillons)} hint="Saisies non soumises" icon={<FileText className="h-5 w-5" />} />
      </div>

      {!hasData ? (
        <Card className="mt-6">
          <EmptyState title="Aucune réponse enregistrée pour l'instant" description="Les graphiques s'afficheront dès les premières saisies." action={can(user, "submission:create") ? <ButtonLink href="/collecte">Commencer une saisie</ButtonLink> : undefined} />
        </Card>
      ) : (
        <div className="mt-6 grid items-start gap-6 xl:grid-cols-5">
          <Card className="xl:col-span-3">
            <CardHeader title="Évolution des collectes" description={`Réponses soumises par jour, ${d.periodDays} derniers jours (date de soumission)`} />
            <div className="p-4">
              <TimelineChart data={d.series} />
              <details className="mt-2 text-sm">
                <summary className="cursor-pointer text-primary-700">Afficher les données sous forme de tableau</summary>
                <Table caption="Réponses par jour">
                  <thead><tr><Th>Date</Th><Th className="text-right">Soumises</Th><Th className="text-right">dont validées</Th></tr></thead>
                  <tbody className="divide-y divide-line">
                    {d.series.filter((s) => s.soumises > 0).map((s) => (
                      <tr key={s.date}><Td>{s.date.split("-").reverse().join("/")}</Td><Td className="text-right tabular-nums">{s.soumises}</Td><Td className="text-right tabular-nums">{s.validees}</Td></tr>
                    ))}
                  </tbody>
                </Table>
              </details>
            </div>
          </Card>

          <Card className="xl:col-span-2">
            <CardHeader title="Alertes qualité" description="Anomalies en cours sur les réponses non rejetées" actions={can(user, "quality:view") ? <ButtonLink href="/qualite" variant="secondary" size="sm">Tout voir</ButtonLink> : undefined} />
            <ul className="divide-y divide-line">
              {(Object.keys(d.issueTotals) as IssueType[]).map((t) => {
                const v = d.issueTotals[t];
                return (
                  <li key={t} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                    <span>{ISSUE_TYPE_LABELS[t]}</span>
                    <span className="flex gap-1.5">
                      {v.erreurs > 0 && <Badge tone="danger">{v.erreurs} erreur{v.erreurs > 1 ? "s" : ""}</Badge>}
                      {v.avertissements > 0 && <Badge tone="warning">{v.avertissements} avert.</Badge>}
                      {v.erreurs + v.avertissements === 0 && <span className="text-muted">0</span>}
                    </span>
                  </li>
                );
              })}
            </ul>
            {d.latestIssues.length > 0 && (
              <div className="border-t border-line px-5 py-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Réponses récentes à examiner</p>
                <ul className="space-y-2.5">
                  {d.latestIssues.map((s) => (
                    <li key={s.id} className="text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link href={`/reponses/${s.id}`} className="font-medium text-primary-700 hover:underline">{s.reference}</Link>
                        <SubmissionStatusBadge status={s.status} />
                      </div>
                      <p className="text-xs text-muted">{s.formTitle} · {s.agentName} · {s.issueCount} anomalie(s)</p>
                      <p className="mt-0.5 line-clamp-2 text-xs text-ink">{s.issues[0]?.message}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>

          <Card className="xl:col-span-5">
            <CardHeader title="Répartition des réponses par formulaire" description="Par statut ; les brouillons sont indiqués dans le tableau" />
            <div className="grid gap-4 p-4">
              <PerFormChart data={d.perForm} />
              <Table caption="Réponses par formulaire">
                <thead><tr><Th>Formulaire</Th><Th className="text-right">Validées</Th><Th className="text-right">En attente</Th><Th className="text-right">À corriger</Th><Th className="text-right">Rejetées</Th><Th className="text-right">Brouillons</Th></tr></thead>
                <tbody className="divide-y divide-line">
                  {d.perForm.map((f) => (
                    <tr key={f.formId}>
                      <Td><span className="font-medium">{f.code}</span><span className="block text-xs text-muted">{f.title}</span></Td>
                      <Td className="text-right tabular-nums">{f.validees}</Td>
                      <Td className="text-right tabular-nums">{f.enAttente}</Td>
                      <Td className="text-right tabular-nums">{f.aCorriger}</Td>
                      <Td className="text-right tabular-nums">{f.rejetees}</Td>
                      <Td className="text-right tabular-nums text-muted">{f.brouillons}</Td>
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
