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

export const metadata = { title: "Rapport" };
const str = (v: string | string[] | undefined) => (typeof v === "string" ? v.slice(0, 20) : "");

export default async function FormReportPage({ params, searchParams }: PageProps<"/rapports/[formId]">) {
  const user = await requirePagePermission("report:view");
  const { formId } = await params;
  const sp = await searchParams;
  const filters = { from: str(sp.from), to: str(sp.to) };
  const r = await getFormReport(user, formId, filters).catch((e) => {
    if (e instanceof NotFoundError) notFound();
    throw e;
  });
  const now = new Date();

  return (
    <>
      <PageHeader
        title={`Rapport — ${r.form.title}`}
        breadcrumb={[{ href: "/rapports", label: "Rapports" }]}
        description={`${r.form.code} · généré le ${formatDate(now)}${filters.from || filters.to ? ` · période de saisie : ${filters.from ? formatDate(filters.from) : "…"} → ${filters.to ? formatDate(filters.to) : "…"}` : ""} · données fictives`}
        actions={<span className="no-print flex gap-2"><PrintButton />{can(user, "export:csv") && <ButtonLink href={withQuery("/api/export", { formId, ...filters })} variant="secondary" prefetch={false}><Download className="h-4 w-4" aria-hidden />CSV</ButtonLink>}</span>}
      />
      <form className="no-print mb-6 flex flex-wrap items-end gap-3">
        <div><label htmlFor="from" className="mb-1 block text-xs font-medium text-muted">Saisie du</label><input id="from" name="from" type="date" defaultValue={filters.from} className={inputClass} /></div>
        <div><label htmlFor="to" className="mb-1 block text-xs font-medium text-muted">au</label><input id="to" name="to" type="date" defaultValue={filters.to} className={inputClass} /></div>
        <Button type="submit" variant="secondary">Appliquer</Button>
      </form>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Total (périmètre)" value={r.total} />
        {SUBMISSION_STATUSES.filter((s) => user.role !== "SUPERVISEUR" || s !== "BROUILLON").map((s) => <StatCard key={s} label={SUBMISSION_STATUS_LABELS[s]} value={r.statusCounts[s] ?? 0} />)}
      </div>
      <p className="mb-4 text-sm text-muted">Statistiques calculées sur {r.analysed} réponse(s) soumise(s), à corriger ou validée(s) (brouillons et rejets exclus). Complétude moyenne : <strong>{formatPercent(r.completenessAvg === null ? null : Math.round(r.completenessAvg * 10) / 10)}</strong>.</p>

      <div className="grid gap-4 md:grid-cols-2">
        {r.stats.map((s) => (
          <Card key={s.key} className="break-inside-avoid">
            <CardHeader title={s.label} description={`${FIELD_TYPE_LABELS[s.type]} · ${s.answered} réponse(s)`} />
            <div className="p-4 text-sm">
              {s.kind === "numeric" && (
                <dl className="grid grid-cols-4 gap-2 text-center">
                  {[["Min.", s.min], ["Moyenne", s.mean], ["Médiane", s.median], ["Max.", s.max]].map(([l, v]) => (
                    <div key={String(l)} className="rounded-md bg-surface p-2"><dt className="text-xs text-muted">{l}</dt><dd className="font-semibold tabular-nums">{formatNumber(v as number | null)}</dd></div>
                  ))}
                </dl>
              )}
              {s.kind === "date" && <p>Du <strong>{s.min ? formatDate(s.min) : "—"}</strong> au <strong>{s.max ? formatDate(s.max) : "—"}</strong></p>}
              {s.kind === "text" && <p>{s.distinct} valeur(s) distincte(s). Réponses libres non agrégées (consultables dans l&apos;export).</p>}
              {s.kind === "distribution" && (
                <ul className="space-y-2">
                  {s.distribution.map((d) => (
                    <li key={d.label}>
                      <div className="flex justify-between gap-2"><span>{d.label}</span><span className="tabular-nums text-muted">{d.count} · {formatPercent(d.percent)}</span></div>
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
