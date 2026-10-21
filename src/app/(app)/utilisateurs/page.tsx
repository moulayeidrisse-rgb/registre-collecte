import Link from "next/link";
import { Plus } from "lucide-react";
import { requirePagePermission } from "@/server/auth/session";
import { listUsers } from "@/server/services/users";
import { Badge, Button, ButtonLink, Card, EmptyState, PageHeader, Table, Td, Th, inputClass } from "@/components/ui";
import { RoleBadge } from "@/components/status";
import { formatDateTime } from "@/lib/format";
import { ROLE_LABELS } from "@/lib/labels";
import { getT } from "@/i18n/server";

export async function generateMetadata() {
  return { title: (await getT())("Utilisateurs") };
}

export default async function UsersPage({ searchParams }: PageProps<"/utilisateurs">) {
  const user = await requirePagePermission("user:manage");
  const t = await getT();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.slice(0, 100) : "";
  const role = typeof sp.role === "string" ? sp.role : "";
  const users = await listUsers(user, { q, role });
  return (
    <>
      <PageHeader t={t} title={t("Utilisateurs")} description={t("Comptes, rôles et affectations. La désactivation d'un compte ferme immédiatement ses sessions.")} actions={<ButtonLink href="/utilisateurs/nouveau"><Plus className="h-4 w-4" aria-hidden />{t("Nouvel utilisateur")}</ButtonLink>} />
      <Card>
        <form className="flex flex-wrap items-end gap-3 border-b border-line p-4" role="search">
          <div className="min-w-48 flex-1">
            <label htmlFor="q" className="mb-1 block text-xs font-medium text-muted">{t("Rechercher")}</label>
            <input id="q" name="q" defaultValue={q} placeholder={t("Nom ou adresse")} className={inputClass} />
          </div>
          <div>
            <label htmlFor="role" className="mb-1 block text-xs font-medium text-muted">{t("Rôle")}</label>
            <select id="role" name="role" defaultValue={role} className={inputClass}>
              <option value="">{t("Tous")}</option>
              {Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{t(v)}</option>)}
            </select>
          </div>
          <Button type="submit" variant="secondary">{t("Filtrer")}</Button>
        </form>
        {users.length === 0 ? <EmptyState title={t("Aucun utilisateur")} /> : (
          <Table caption={t("Utilisateurs")}>
            <thead><tr><Th>{t("Nom")}</Th><Th>{t("Rôle")}</Th><Th>{t("État")}</Th><Th className="text-end">{t("Formulaires affectés")}</Th><Th className="text-end">{t("Réponses saisies")}</Th><Th>{t("Dernière connexion")}</Th></tr></thead>
            <tbody className="divide-y divide-line bg-white">
              {users.map((u) => (
                <tr key={u.id}>
                  <Td><Link href={`/utilisateurs/${u.id}`} className="font-medium text-primary-700 hover:underline">{u.name}</Link><span className="block text-xs text-muted break-all" dir="ltr">{u.email}</span></Td>
                  <Td><RoleBadge role={u.role} t={t} /></Td>
                  <Td>{u.isActive ? <Badge tone="success">{t("Actif")}</Badge> : <Badge tone="danger">{t("Désactivé")}</Badge>}{u.mustChangePassword && <Badge tone="warning" className="ms-1">{t("Mot de passe à changer")}</Badge>}</Td>
                  <Td className="text-end tabular-nums">{u.role === "ADMIN" ? t("Tous") : u._count.assignments}</Td>
                  <Td className="text-end tabular-nums">{u._count.submissions}</Td>
                  <Td className="whitespace-nowrap text-muted">{formatDateTime(u.lastLoginAt, t.locale)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
