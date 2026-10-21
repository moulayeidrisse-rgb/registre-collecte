import Link from "next/link";
import { Plus } from "lucide-react";
import { requirePagePermission } from "@/server/auth/session";
import { can } from "@/server/auth/permissions";
import { listForms } from "@/server/services/forms";
import { Button, ButtonLink, Card, EmptyState, PageHeader, Table, Td, Th, inputClass } from "@/components/ui";
import { FormStatusBadge } from "@/components/status";
import { formatDateTime } from "@/lib/format";
import { getT } from "@/i18n/server";

export async function generateMetadata() {
  return { title: (await getT())("Formulaires") };
}

export default async function FormsPage({ searchParams }: PageProps<"/formulaires">) {
  const user = await requirePagePermission("form:view");
  const t = await getT();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const status = typeof sp.status === "string" ? sp.status : "";
  const forms = await listForms(user, { q, status });
  const manage = can(user, "form:manage");

  return (
    <>
      <PageHeader
        t={t}
        title={t("Formulaires")}
        description={manage ? t("Créez, modifiez, publiez et suivez les formulaires de collecte.") : t("Formulaires qui vous sont affectés.")}
        actions={manage && <ButtonLink href="/formulaires/nouveau"><Plus className="h-4 w-4" aria-hidden />{t("Nouveau formulaire")}</ButtonLink>}
      />
      <Card>
        <form className="flex flex-wrap items-end gap-3 border-b border-line p-4" role="search">
          <div className="min-w-48 flex-1">
            <label htmlFor="q" className="mb-1 block text-xs font-medium text-muted">{t("Rechercher")}</label>
            <input id="q" name="q" defaultValue={q} placeholder={t("Titre ou code")} className={inputClass} />
          </div>
          <div>
            <label htmlFor="status" className="mb-1 block text-xs font-medium text-muted">{t("Statut")}</label>
            <select id="status" name="status" defaultValue={status} className={inputClass}>
              <option value="">{t("Tous")}</option>
              {manage && <option value="BROUILLON">{t("Brouillon")}</option>}
              <option value="PUBLIE">{t("Publié")}</option>
              <option value="DESACTIVE">{t("Désactivé")}</option>
            </select>
          </div>
          <Button type="submit" variant="secondary">{t("Filtrer")}</Button>
        </form>
        {forms.length === 0 ? (
          <EmptyState title={t("Aucun formulaire")} description={q || status ? t("Aucun formulaire ne correspond à ces critères.") : manage ? t("Commencez par créer un formulaire.") : t("Aucun formulaire ne vous est affecté pour le moment.")} />
        ) : (
          <Table caption={t("Liste des formulaires")}>
            <thead>
              <tr><Th>{t("Formulaire")}</Th><Th>{t("Statut")}</Th><Th>{t("Version publiée")}</Th><Th className="text-end">{t("Questions")}</Th><Th className="text-end">{t("Réponses")}</Th>{manage && <Th className="text-end">{t("Affectés")}</Th>}<Th>{t("Mis à jour")}</Th></tr>
            </thead>
            <tbody className="divide-y divide-line bg-white">
              {forms.map((f) => (
                <tr key={f.id} className="hover:bg-surface/60">
                  <Td>
                    <Link href={`/formulaires/${f.id}`} className="font-medium text-primary-700 hover:underline">{f.title}</Link>
                    <span className="block text-xs text-muted">{f.code}{f.hasDraft && manage && f.publishedVersion ? ` · ${t("nouvelle version en préparation")}` : ""}</span>
                  </Td>
                  <Td><FormStatusBadge status={f.status} t={t} /></Td>
                  <Td>{f.publishedVersion ? `v${f.publishedVersion}` : "—"}</Td>
                  <Td className="text-end tabular-nums">{f.fieldCount}</Td>
                  <Td className="text-end tabular-nums">{f.submissionCount}</Td>
                  {manage && <Td className="text-end tabular-nums">{f.assignmentCount}</Td>}
                  <Td className="whitespace-nowrap text-muted">{formatDateTime(f.updatedAt, t.locale)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
