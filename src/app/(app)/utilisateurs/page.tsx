import Link from "next/link";
import { Plus } from "lucide-react";
import { requirePagePermission } from "@/server/auth/session";
import { listUsers } from "@/server/services/users";
import { Badge, Button, ButtonLink, Card, EmptyState, PageHeader, Table, Td, Th, inputClass } from "@/components/ui";
import { RoleBadge } from "@/components/status";
import { formatDateTime } from "@/lib/format";
import { ROLE_LABELS } from "@/lib/labels";

export const metadata = { title: "Utilisateurs" };

export default async function UsersPage({ searchParams }: PageProps<"/utilisateurs">) {
  const user = await requirePagePermission("user:manage");
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.slice(0, 100) : "";
  const role = typeof sp.role === "string" ? sp.role : "";
  const users = await listUsers(user, { q, role });
  return (
    <>
      <PageHeader title="Utilisateurs" description="Comptes, rôles et affectations. La désactivation d'un compte ferme immédiatement ses sessions." actions={<ButtonLink href="/utilisateurs/nouveau"><Plus className="h-4 w-4" aria-hidden />Nouvel utilisateur</ButtonLink>} />
      <Card>
        <form className="flex flex-wrap items-end gap-3 border-b border-line p-4" role="search">
          <div className="min-w-48 flex-1">
            <label htmlFor="q" className="mb-1 block text-xs font-medium text-muted">Rechercher</label>
            <input id="q" name="q" defaultValue={q} placeholder="Nom ou adresse" className={inputClass} />
          </div>
          <div>
            <label htmlFor="role" className="mb-1 block text-xs font-medium text-muted">Rôle</label>
            <select id="role" name="role" defaultValue={role} className={inputClass}>
              <option value="">Tous</option>
              {Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <Button type="submit" variant="secondary">Filtrer</Button>
        </form>
        {users.length === 0 ? <EmptyState title="Aucun utilisateur" /> : (
          <Table caption="Utilisateurs">
            <thead><tr><Th>Nom</Th><Th>Rôle</Th><Th>État</Th><Th className="text-right">Formulaires affectés</Th><Th className="text-right">Réponses saisies</Th><Th>Dernière connexion</Th></tr></thead>
            <tbody className="divide-y divide-line bg-white">
              {users.map((u) => (
                <tr key={u.id}>
                  <Td><Link href={`/utilisateurs/${u.id}`} className="font-medium text-primary-700 hover:underline">{u.name}</Link><span className="block text-xs text-muted break-all">{u.email}</span></Td>
                  <Td><RoleBadge role={u.role} /></Td>
                  <Td>{u.isActive ? <Badge tone="success">Actif</Badge> : <Badge tone="danger">Désactivé</Badge>}{u.mustChangePassword && <Badge tone="warning" className="ml-1">Mot de passe à changer</Badge>}</Td>
                  <Td className="text-right tabular-nums">{u.role === "ADMIN" ? "Tous" : u._count.assignments}</Td>
                  <Td className="text-right tabular-nums">{u._count.submissions}</Td>
                  <Td className="whitespace-nowrap text-muted">{formatDateTime(u.lastLoginAt)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
