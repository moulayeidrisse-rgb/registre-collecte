import Link from "next/link";
import { Plus } from "lucide-react";
import { requirePagePermission } from "@/server/auth/session";
import { can } from "@/server/auth/permissions";
import { listForms } from "@/server/services/forms";
import { Button, ButtonLink, Card, EmptyState, PageHeader, Table, Td, Th, inputClass } from "@/components/ui";
import { FormStatusBadge } from "@/components/status";
import { formatDateTime } from "@/lib/format";

export const metadata = { title: "Formulaires" };

export default async function FormsPage({ searchParams }: PageProps<"/formulaires">) {
  const user = await requirePagePermission("form:view");
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const status = typeof sp.status === "string" ? sp.status : "";
  const forms = await listForms(user, { q, status });
  const manage = can(user, "form:manage");

  return (
    <>
      <PageHeader
        title="Formulaires"
        description={manage ? "Créez, modifiez, publiez et suivez les formulaires de collecte." : "Formulaires qui vous sont affectés."}
        actions={manage && <ButtonLink href="/formulaires/nouveau"><Plus className="h-4 w-4" aria-hidden />Nouveau formulaire</ButtonLink>}
      />
      <Card>
        <form className="flex flex-wrap items-end gap-3 border-b border-line p-4" role="search">
          <div className="min-w-48 flex-1">
            <label htmlFor="q" className="mb-1 block text-xs font-medium text-muted">Rechercher</label>
            <input id="q" name="q" defaultValue={q} placeholder="Titre ou code" className={inputClass} />
          </div>
          <div>
            <label htmlFor="status" className="mb-1 block text-xs font-medium text-muted">Statut</label>
            <select id="status" name="status" defaultValue={status} className={inputClass}>
              <option value="">Tous</option>
              {manage && <option value="BROUILLON">Brouillon</option>}
              <option value="PUBLIE">Publié</option>
              <option value="DESACTIVE">Désactivé</option>
            </select>
          </div>
          <Button type="submit" variant="secondary">Filtrer</Button>
        </form>
        {forms.length === 0 ? (
          <EmptyState title="Aucun formulaire" description={q || status ? "Aucun formulaire ne correspond à ces critères." : manage ? "Commencez par créer un formulaire." : "Aucun formulaire ne vous est affecté pour le moment."} />
        ) : (
          <Table caption="Liste des formulaires">
            <thead>
              <tr><Th>Formulaire</Th><Th>Statut</Th><Th>Version publiée</Th><Th className="text-right">Questions</Th><Th className="text-right">Réponses</Th>{manage && <Th className="text-right">Affectés</Th>}<Th>Mis à jour</Th></tr>
            </thead>
            <tbody className="divide-y divide-line bg-white">
              {forms.map((f) => (
                <tr key={f.id} className="hover:bg-surface/60">
                  <Td>
                    <Link href={`/formulaires/${f.id}`} className="font-medium text-primary-700 hover:underline">{f.title}</Link>
                    <span className="block text-xs text-muted">{f.code}{f.hasDraft && manage && f.publishedVersion ? " · nouvelle version en préparation" : ""}</span>
                  </Td>
                  <Td><FormStatusBadge status={f.status} /></Td>
                  <Td>{f.publishedVersion ? `v${f.publishedVersion}` : "—"}</Td>
                  <Td className="text-right tabular-nums">{f.fieldCount}</Td>
                  <Td className="text-right tabular-nums">{f.submissionCount}</Td>
                  {manage && <Td className="text-right tabular-nums">{f.assignmentCount}</Td>}
                  <Td className="whitespace-nowrap text-muted">{formatDateTime(f.updatedAt)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
