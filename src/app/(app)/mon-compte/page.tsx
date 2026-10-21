import { requireUser } from "@/server/auth/session";
import { ROLE_LABELS } from "@/lib/labels";
import { Alert, Card, CardHeader, PageHeader } from "@/components/ui";
import { PasswordForm } from "./password-form";
import { ROLE_PERMISSIONS } from "@/server/auth/permissions";

export const metadata = { title: "Mon compte" };

const PERMISSION_LABELS: Record<string, string> = {
  "dashboard:view": "Consulter le tableau de bord",
  "form:view": "Consulter les formulaires",
  "form:manage": "Créer, modifier et publier des formulaires",
  "submission:create": "Saisir des réponses",
  "submission:view_own": "Consulter ses propres réponses",
  "submission:view_scope": "Consulter les réponses des formulaires suivis",
  "submission:view_all": "Consulter toutes les réponses",
  "submission:review": "Valider, rejeter ou renvoyer des réponses",
  "submission:edit_any": "Corriger toute réponse",
  "quality:view": "Consulter le contrôle qualité",
  "quality:rescan": "Relancer le contrôle qualité",
  "export:csv": "Exporter en CSV",
  "report:view": "Consulter les rapports",
  "user:manage": "Gérer les utilisateurs",
  "audit:view": "Consulter le journal d'audit",
};

export default async function AccountPage({ searchParams }: PageProps<"/mon-compte">) {
  const user = await requireUser({ allowPasswordChange: true });
  const sp = await searchParams;
  return (
    <>
      <PageHeader title="Mon compte" description="Informations de profil et sécurité du compte." />
      {(user.mustChangePassword || sp.changement) && (
        <Alert tone="warning" className="mb-6" title="Changement de mot de passe requis">
          Pour des raisons de sécurité, choisissez un nouveau mot de passe avant de continuer.
        </Alert>
      )}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Profil" />
          <dl className="grid grid-cols-3 gap-x-4 gap-y-3 p-5 text-sm">
            <dt className="text-muted">Nom</dt><dd className="col-span-2 font-medium">{user.name}</dd>
            <dt className="text-muted">Adresse</dt><dd className="col-span-2 break-all">{user.email}</dd>
            <dt className="text-muted">Rôle</dt><dd className="col-span-2">{ROLE_LABELS[user.role]}</dd>
            <dt className="text-muted">Droits</dt>
            <dd className="col-span-2">
              <ul className="list-disc space-y-0.5 pl-4 text-muted">
                {ROLE_PERMISSIONS[user.role].map((p) => <li key={p}>{PERMISSION_LABELS[p]}</li>)}
              </ul>
            </dd>
          </dl>
        </Card>
        <Card>
          <CardHeader title="Changer de mot de passe" />
          <div className="p-5"><PasswordForm /></div>
        </Card>
      </div>
    </>
  );
}
