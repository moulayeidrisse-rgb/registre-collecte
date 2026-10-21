import Link from "next/link";
import { requirePagePermission } from "@/server/auth/session";
import { listQualityIssues } from "@/server/services/audit-log";
import { getDashboard } from "@/server/services/dashboard";
import { listForms } from "@/server/services/forms";
import { Button, Card, CardHeader, EmptyState, PageHeader, Pagination, StatCard, Table, Td, Th, inputClass, withQuery } from "@/components/ui";
import { SeverityBadge, SubmissionStatusBadge } from "@/components/status";
import { ISSUE_TYPE_LABELS } from "@/lib/labels";
import type { IssueType } from "@/generated/prisma/enums";
import { getT } from "@/i18n/server";

export async function generateMetadata() {
  return { title: (await getT())("Qualité des données") };
}
const str = (v: string | string[] | undefined) => (typeof v === "string" ? v.slice(0, 60) : "");

export default async function QualityPage({ searchParams }: PageProps<"/qualite">) {
  const user = await requirePagePermission("quality:view");
  const t = await getT();
  const sp = await searchParams;
  const filters = { type: str(sp.type), severity: str(sp.severity), formId: str(sp.formId) };
  const page = Math.max(1, Number(str(sp.page)) || 1);
  const [issues, dash, forms] = await Promise.all([listQualityIssues(user, filters, page), getDashboard(user), listForms(user)]);

  return (
    <>
      <PageHeader t={t} title={t("Qualité des données")} description={t("Anomalies détectées automatiquement à chaque enregistrement : champs obligatoires manquants, valeurs hors plage, formats invalides, doublons potentiels et incohérences entre champs.")} />
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
        {(Object.keys(dash.issueTotals) as IssueType[]).map((k) => (
          <Link key={k} href={withQuery("/qualite", { ...filters, type: k, page: undefined })} className="rounded-lg focus-visible:outline-2">
            <StatCard label={t(ISSUE_TYPE_LABELS[k])} value={dash.issueTotals[k].erreurs + dash.issueTotals[k].avertissements} hint={t("{a} erreur(s) · {b} avertissement(s)", { a: dash.issueTotals[k].erreurs, b: dash.issueTotals[k].avertissements })} tone={dash.issueTotals[k].erreurs ? "danger" : dash.issueTotals[k].avertissements ? "warning" : "neutral"} />
          </Link>
        ))}
      </div>
      <Card>
        <CardHeader title={t("Anomalies en cours")} description={t("Les erreurs bloquent la soumission (elles concernent donc surtout les brouillons) ; les avertissements sont à examiner par le superviseur.")} />
        <form className="flex flex-wrap items-end gap-3 border-b border-line p-4" role="search">
          <div>
            <label htmlFor="type" className="mb-1 block text-xs font-medium text-muted">{t("Type")}</label>
            <select id="type" name="type" defaultValue={filters.type} className={inputClass}>
              <option value="">{t("Tous")}</option>
              {(Object.keys(ISSUE_TYPE_LABELS) as IssueType[]).map((k) => <option key={k} value={k}>{t(ISSUE_TYPE_LABELS[k])}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="severity" className="mb-1 block text-xs font-medium text-muted">{t("Gravité")}</label>
            <select id="severity" name="severity" defaultValue={filters.severity} className={inputClass}>
              <option value="">{t("Toutes")}</option><option value="ERREUR">{t("Erreur")}</option><option value="AVERTISSEMENT">{t("Avertissement")}</option>
            </select>
          </div>
          <div>
            <label htmlFor="formId" className="mb-1 block text-xs font-medium text-muted">{t("Formulaire")}</label>
            <select id="formId" name="formId" defaultValue={filters.formId} className={inputClass}>
              <option value="">{t("Tous")}</option>
              {forms.map((f) => <option key={f.id} value={f.id}>{f.code}</option>)}
            </select>
          </div>
          <Button type="submit" variant="secondary">{t("Filtrer")}</Button>
        </form>
        {issues.rows.length === 0 ? (
          <EmptyState title={t("Aucune anomalie")} description={t("Aucune anomalie ne correspond à ces critères.")} />
        ) : (
          <>
            <Table caption={t("Anomalies")}>
              <thead><tr><Th>{t("Réponse")}</Th><Th>{t("Gravité")}</Th><Th>{t("Type")}</Th><Th>{t("Message")}</Th><Th>{t("Agent")}</Th></tr></thead>
              <tbody className="divide-y divide-line bg-white">
                {issues.rows.map((i) => (
                  <tr key={i.id}>
                    <Td>
                      <Link href={`/reponses/${i.submission.id}`} className="font-medium text-primary-700 hover:underline" dir="ltr">{i.submission.reference}</Link>
                      <div className="mt-1"><SubmissionStatusBadge status={i.submission.status} t={t} /></div>
                    </Td>
                    <Td><SeverityBadge severity={i.severity} t={t} /></Td>
                    <Td className="whitespace-nowrap">{t(ISSUE_TYPE_LABELS[i.type])}</Td>
                    <Td className="min-w-64">{t.msg(i.message)}<span className="block text-xs text-muted">{i.submission.version.form.title}{i.field ? ` · ${i.field.label}` : ""}</span></Td>
                    <Td className="whitespace-nowrap">{i.submission.agent.name}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <Pagination t={t} page={issues.page} pageSize={issues.pageSize} total={issues.total} hrefFor={(p) => withQuery("/qualite", { ...filters, page: p })} />
          </>
        )}
      </Card>
    </>
  );
}
