import Link from "next/link";
import { Download } from "lucide-react";
import { requireUser } from "@/server/auth/session";
import { can } from "@/server/auth/permissions";
import { listSubmissions, SUBMISSION_STATUSES } from "@/server/services/submissions";
import { listForms } from "@/server/services/forms";
import { Badge, Button, ButtonLink, Card, EmptyState, PageHeader, Pagination, Table, Td, Th, inputClass, withQuery } from "@/components/ui";
import { SubmissionStatusBadge } from "@/components/status";
import { SUBMISSION_STATUS_LABELS } from "@/lib/labels";
import { formatDate, formatDateTime } from "@/lib/format";
import { redirect } from "next/navigation";

export const metadata = { title: "Réponses" };

const str = (v: string | string[] | undefined) => (typeof v === "string" ? v.slice(0, 100) : "");

export default async function ResponsesPage({ searchParams }: PageProps<"/reponses">) {
  const user = await requireUser();
  if (!can(user, "submission:view_all") && !can(user, "submission:view_scope") && !can(user, "submission:view_own")) redirect("/acces-refuse");
  const sp = await searchParams;
  const filters = { q: str(sp.q), formId: str(sp.formId), status: str(sp.status), from: str(sp.from), to: str(sp.to), hasIssues: str(sp.anomalies) };
  const page = Math.max(1, Number(str(sp.page)) || 1);
  const [result, forms] = await Promise.all([listSubmissions(user, filters, page), listForms(user)]);
  const statuses = user.role === "SUPERVISEUR" ? SUBMISSION_STATUSES.filter((s) => s !== "BROUILLON") : SUBMISSION_STATUSES;
  const exportHref = withQuery("/api/export", { formId: filters.formId, status: filters.status, from: filters.from, to: filters.to, q: filters.q });
  const hasFilters = Object.values(filters).some(Boolean);

  return (
    <>
      <PageHeader
        title={user.role === "AGENT" ? "Mes réponses" : "Réponses"}
        description={user.role === "AGENT" ? "Suivez le statut de vos saisies et reprenez vos brouillons." : user.role === "SUPERVISEUR" ? "Réponses soumises sur les formulaires dont vous assurez le suivi." : "Toutes les réponses enregistrées."}
        actions={can(user, "export:csv") && (
          filters.formId ? (
            <ButtonLink href={exportHref} variant="secondary" prefetch={false}><Download className="h-4 w-4" aria-hidden />Exporter en CSV</ButtonLink>
          ) : (
            <Button variant="secondary" disabled title="Choisissez un formulaire pour exporter"><Download className="h-4 w-4" aria-hidden />Exporter en CSV</Button>
          )
        )}
      />
      <Card>
        <form className="grid gap-3 border-b border-line p-4 sm:grid-cols-2 lg:grid-cols-6" role="search">
          <div className="lg:col-span-2">
            <label htmlFor="q" className="mb-1 block text-xs font-medium text-muted">Rechercher</label>
            <input id="q" name="q" defaultValue={filters.q} placeholder="Référence, agent, valeur saisie…" className={inputClass} />
          </div>
          <div>
            <label htmlFor="formId" className="mb-1 block text-xs font-medium text-muted">Formulaire</label>
            <select id="formId" name="formId" defaultValue={filters.formId} className={inputClass}>
              <option value="">Tous</option>
              {forms.map((f) => <option key={f.id} value={f.id}>{f.code} — {f.title}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="status" className="mb-1 block text-xs font-medium text-muted">Statut</label>
            <select id="status" name="status" defaultValue={filters.status} className={inputClass}>
              <option value="">Tous</option>
              {statuses.map((s) => <option key={s} value={s}>{SUBMISSION_STATUS_LABELS[s]}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="from" className="mb-1 block text-xs font-medium text-muted">Saisie du</label>
            <input id="from" name="from" type="date" defaultValue={filters.from} className={inputClass} />
          </div>
          <div>
            <label htmlFor="to" className="mb-1 block text-xs font-medium text-muted">au</label>
            <input id="to" name="to" type="date" defaultValue={filters.to} className={inputClass} />
          </div>
          <label className="flex items-center gap-2 text-sm sm:col-span-2 lg:col-span-3">
            <input type="checkbox" name="anomalies" value="1" defaultChecked={filters.hasIssues === "1"} /> Uniquement les réponses avec anomalies
          </label>
          <div className="flex gap-2 sm:col-span-2 lg:col-span-3 lg:justify-end">
            {hasFilters && <ButtonLink href="/reponses" variant="ghost">Réinitialiser</ButtonLink>}
            <Button type="submit" variant="secondary">Appliquer les filtres</Button>
          </div>
        </form>
        {result.rows.length === 0 ? (
          <EmptyState title="Aucune réponse" description={hasFilters ? "Aucune réponse ne correspond à ces critères." : "Aucune réponse n'a encore été enregistrée."} action={can(user, "submission:create") ? <ButtonLink href="/collecte">Commencer une saisie</ButtonLink> : undefined} />
        ) : (
          <>
            <Table caption="Liste des réponses">
              <thead>
                <tr><Th>Référence</Th><Th>Formulaire</Th>{user.role !== "AGENT" && <Th>Agent</Th>}<Th>Statut</Th><Th className="text-right">Complétude</Th><Th>Anomalies</Th><Th>Saisie</Th><Th>Soumise</Th></tr>
              </thead>
              <tbody className="divide-y divide-line bg-white">
                {result.rows.map((r) => (
                  <tr key={r.id} className="hover:bg-surface/60">
                    <Td className="whitespace-nowrap"><Link href={`/reponses/${r.id}`} className="font-medium text-primary-700 hover:underline">{r.reference}</Link></Td>
                    <Td><span className="block max-w-56 truncate" title={r.formTitle}>{r.formTitle}</span><span className="text-xs text-muted">{r.formCode} · v{r.versionNumber}</span></Td>
                    {user.role !== "AGENT" && <Td className="whitespace-nowrap">{r.agentName}</Td>}
                    <Td><SubmissionStatusBadge status={r.status} /></Td>
                    <Td className="text-right tabular-nums">{r.completeness} %</Td>
                    <Td>
                      <span className="flex gap-1">
                        {r.errorCount > 0 && <Badge tone="danger">{r.errorCount} err.</Badge>}
                        {r.warningCount > 0 && <Badge tone="warning">{r.warningCount} avert.</Badge>}
                        {r.errorCount + r.warningCount === 0 && <span className="text-muted">—</span>}
                      </span>
                    </Td>
                    <Td className="whitespace-nowrap text-muted">{formatDate(r.createdAt)}</Td>
                    <Td className="whitespace-nowrap text-muted">{formatDateTime(r.submittedAt)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <Pagination page={result.page} pageSize={result.pageSize} total={result.total} hrefFor={(p) => withQuery("/reponses", { ...filters, anomalies: filters.hasIssues, hasIssues: undefined, page: p })} />
          </>
        )}
      </Card>
      <p className="mt-3 text-xs text-muted">{result.total} réponse(s). La période filtre sur la date de saisie.</p>
    </>
  );
}
