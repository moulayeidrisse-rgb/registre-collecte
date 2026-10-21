import { notFound } from "next/navigation";
import { Download } from "lucide-react";
import { requirePagePermission } from "@/server/auth/session";
import { can } from "@/server/auth/permissions";
import { NotFoundError } from "@/server/errors";
import { getFormReport } from "@/server/services/reports";
import { Button, ButtonLink, Card, CardHeader, PageHeader, StatCard, inputClass, withQuery } from "@/components/ui";
import { FIELD_TYPE_LABELS, SUBMISSION_STATUS_LABELS } from "@/lib/labels";
import { formatDate, formatNumber, formatPercent } from "@/lib/format";
import { SUBMISSION_STATUSES } from "@/server/services/submissions";
import { PrintButton } from "./print-button";
import { getT } from "@/i18n/server";

export async function generateMetadata() {
  return { title: (await getT())("Rapport") };
}
const str = (v: string | string[] | undefined) => (typeof v === "string" ? v.slice(0, 20) : "");

export default async function FormReportPage({ params, searchParams }: PageProps<"/rapports/[formId]">) {
  const user = await requirePagePermission("report:view");
  const t = await getT();
  const L = t.locale;
  const { formId } = await params;
  const sp = await searchParams;
  const filters = { from: str(sp.from), to: str(sp.to) };
  const r = await getFormReport(user, formId, filters).catch((e) => {
    if (e instanceof NotFoundError) notFound();
    throw e;
  });
  const now = new Date();
  const period = filters.from || filters.to ? ` · ${t("période de saisie : {a} → {b}", { a: filters.from ? formatDate(filters.from, L) : "…", b: filters.to ? formatDate(filters.to, L) : "…" })}` : "";

  return (
    <>
      <PageHeader
        t={t}
        title={t("Rapport — {title}", { title: r.form.title })}
        breadcrumb={[{ href: "/rapports", label: t("Rapports") }]}
        description={`${r.form.code} · ${t("généré le {date}", { date: formatDate(now, L) })}${period} · ${t("données fictives")}`}
        actions={<span className="no-print flex gap-2"><PrintButton />{can(user, "export:csv") && <ButtonLink href={withQuery("/api/export", { formId, ...filters })} variant="secondary" prefetch={false}><Download className="h-4 w-4" aria-hidden />CSV</ButtonLink>}</span>}
      />
      <form className="no-print mb-6 flex flex-wrap items-end gap-3">
        <div><label htmlFor="from" className="mb-1 block text-xs font-medium text-muted">{t("Saisie du")}</label><input id="from" name="from" type="date" defaultValue={filters.from} className={inputClass} /></div>
        <div><label htmlFor="to" className="mb-1 block text-xs font-medium text-muted">{t("au")}</label><input id="to" name="to" type="date" defaultValue={filters.to} className={inputClass} /></div>
        <Button type="submit" variant="secondary">{t("Appliquer")}</Button>
      </form>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <StatCard label={t("Total (périmètre)")} value={r.total} />
        {SUBMISSION_STATUSES.filter((s) => user.role !== "SUPERVISEUR" || s !== "BROUILLON").map((s) => <StatCard key={s} label={t(SUBMISSION_STATUS_LABELS[s])} value={r.statusCounts[s] ?? 0} />)}
      </div>
      <p className="mb-4 text-sm text-muted">
        {t("Statistiques calculées sur {n} réponse(s) soumise(s), à corriger ou validée(s) (brouillons et rejets exclus). Complétude moyenne :", { n: r.analysed })}{" "}
        <strong>{formatPercent(r.completenessAvg === null ? null : Math.round(r.completenessAvg * 10) / 10, L)}</strong>.
      </p>

      <div className="grid gap-4 md:grid-cols-2">
        {r.stats.map((s) => (
          <Card key={s.key} className="break-inside-avoid">
            <CardHeader title={s.label} description={`${t(FIELD_TYPE_LABELS[s.type])} · ${t("{n} réponse(s)", { n: s.answered })}`} />
            <div className="p-4 text-sm">
              {s.kind === "numeric" && (
                <dl className="grid grid-cols-4 gap-2 text-center">
                  {[[t("Min."), s.min], [t("Moyenne"), s.mean], [t("Médiane"), s.median], [t("Max."), s.max]].map(([l, v]) => (
                    <div key={String(l)} className="rounded-md bg-surface p-2"><dt className="text-xs text-muted">{l}</dt><dd className="font-semibold tabular-nums">{formatNumber(v as number | null, L)}</dd></div>
                  ))}
                </dl>
              )}
              {s.kind === "date" && <p>{t("Du {a} au {b}", { a: s.min ? formatDate(s.min, L) : "—", b: s.max ? formatDate(s.max, L) : "—" })}</p>}
              {s.kind === "text" && <p>{t("{n} valeur(s) distincte(s). Réponses libres non agrégées (consultables dans l'export).", { n: s.distinct })}</p>}
              {s.kind === "distribution" && (
                <ul className="space-y-2">
                  {s.distribution.map((d) => (
                    <li key={d.label}>
                      <div className="flex justify-between gap-2"><span>{s.type === "OUI_NON" ? t(d.label) : d.label}</span><span className="tabular-nums text-muted">{d.count} · {formatPercent(d.percent, L)}</span></div>
                      <div className="mt-1 h-2 rounded-full bg-surface" aria-hidden><div className="h-2 rounded-full bg-primary-600" style={{ width: `${Math.min(100, d.percent)}%` }} /></div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
