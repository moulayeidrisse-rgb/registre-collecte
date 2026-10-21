import Link from "next/link";
import { requirePagePermission } from "@/server/auth/session";
import { listAuditLogs } from "@/server/services/audit-log";
import { Button, Card, EmptyState, PageHeader, Pagination, Table, Td, Th, inputClass, withQuery } from "@/components/ui";
import { AUDIT_ACTION_LABELS } from "@/lib/labels";
import { formatDateTime } from "@/lib/format";
import { getT } from "@/i18n/server";

export async function generateMetadata() {
  return { title: (await getT())("Journal d'audit") };
}
const str = (v: string | string[] | undefined) => (typeof v === "string" ? v.slice(0, 60) : "");
const GROUPS = [["", "Toutes"], ["auth.", "Authentification"], ["user.", "Utilisateurs"], ["form.", "Formulaires"], ["submission.", "Réponses"], ["export.", "Exports"], ["quality.", "Qualité"], ["access.", "Accès refusés"]];

export default async function AuditPage({ searchParams }: PageProps<"/journal">) {
  const user = await requirePagePermission("audit:view");
  const t = await getT();
  const sp = await searchParams;
  const filters = { action: str(sp.action), q: str(sp.q) };
  const page = Math.max(1, Number(str(sp.page)) || 1);
  const r = await listAuditLogs(user, filters, page);

  return (
    <>
      <PageHeader t={t} title={t("Journal d'audit")} description={t("Traçabilité des actions sensibles (connexions, gestion des utilisateurs et formulaires, changements de statut, exports). Aucun mot de passe ni jeton n'y est enregistré.")} />
      <Card>
        <form className="flex flex-wrap items-end gap-3 border-b border-line p-4" role="search">
          <div>
            <label htmlFor="action" className="mb-1 block text-xs font-medium text-muted">{t("Catégorie")}</label>
            <select id="action" name="action" defaultValue={filters.action} className={inputClass}>
              {GROUPS.map(([v, l]) => <option key={v} value={v}>{t(l)}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="q" className="mb-1 block text-xs font-medium text-muted">{t("Utilisateur")}</label>
            <input id="q" name="q" defaultValue={filters.q} className={inputClass} placeholder={t("Nom")} />
          </div>
          <Button type="submit" variant="secondary">{t("Filtrer")}</Button>
        </form>
        {r.rows.length === 0 ? <EmptyState title={t("Aucun événement")} /> : (
          <>
            <Table caption={t("Événements d'audit")}>
              <thead><tr><Th>{t("Date")}</Th><Th>{t("Action")}</Th><Th>{t("Utilisateur")}</Th><Th>{t("Objet")}</Th><Th>{t("Détails")}</Th><Th>{t("Adresse IP")}</Th></tr></thead>
              <tbody className="divide-y divide-line bg-white">
                {r.rows.map((l) => (
                  <tr key={l.id}>
                    <Td className="whitespace-nowrap text-muted">{formatDateTime(l.createdAt, t.locale)}</Td>
                    <Td className="whitespace-nowrap font-medium">{t(AUDIT_ACTION_LABELS[l.action] ?? l.action)}</Td>
                    <Td className="whitespace-nowrap">{l.actor?.name ?? "—"}</Td>
                    <Td className="whitespace-nowrap">
                      {l.entityType === "Submission" && l.entityId ? <Link href={`/reponses/${l.entityId}`} className="text-primary-700 hover:underline">{t("Réponse")}</Link>
                        : l.entityType === "Form" && l.entityId ? <Link href={`/formulaires/${l.entityId}`} className="text-primary-700 hover:underline">{t("Formulaire")}</Link>
                        : l.entityType === "User" && l.entityId ? <Link href={`/utilisateurs/${l.entityId}`} className="text-primary-700 hover:underline">{t("Utilisateur")}</Link>
                        : l.entityType ?? "—"}
                    </Td>
                    <Td><code dir="ltr" className="block max-w-md truncate text-xs text-muted" title={l.metadata ? JSON.stringify(l.metadata) : ""}>{l.metadata ? JSON.stringify(l.metadata) : ""}</code></Td>
                    <Td className="text-xs text-muted" ><span dir="ltr">{l.ipAddress ?? "—"}</span></Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <Pagination t={t} page={r.page} pageSize={r.pageSize} total={r.total} hrefFor={(p) => withQuery("/journal", { ...filters, page: p })} />
          </>
        )}
      </Card>
    </>
  );
}
