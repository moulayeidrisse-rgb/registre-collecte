import { notFound } from "next/navigation";
import { requirePagePermission } from "@/server/auth/session";
import { NotFoundError } from "@/server/errors";
import { getUser } from "@/server/services/users";
import { listForms } from "@/server/services/forms";
import { Alert, Card, CardHeader, PageHeader } from "@/components/ui";
import { RoleBadge } from "@/components/status";
import { formatDateTime } from "@/lib/format";
import { EditUserForm, ResetPasswordForm, UserAssignmentsForm } from "../user-forms";

export const metadata = { title: "Utilisateur" };

export default async function UserPage({ params, searchParams }: PageProps<"/utilisateurs/[id]">) {
  const actor = await requirePagePermission("user:manage");
  const { id } = await params;
  const sp = await searchParams;
  const u = await getUser(actor, id).catch((e) => {
    if (e instanceof NotFoundError) notFound();
    throw e;
  });
  const forms = u.role === "ADMIN" ? [] : await listForms(actor);
  return (
    <>
      <PageHeader title={u.name} breadcrumb={[{ href: "/utilisateurs", label: "Utilisateurs" }]} description={<span className="flex flex-wrap items-center gap-2"><span className="break-all">{u.email}</span><RoleBadge role={u.role} /><span>Dernière connexion : {formatDateTime(u.lastLoginAt)}</span></span>} />
      {sp.cree && <Alert tone="success" className="mb-6">Compte créé. Affectez-lui maintenant des formulaires si nécessaire.</Alert>}
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <Card><CardHeader title="Profil et rôle" /><EditUserForm user={u} /></Card>
          <Card><CardHeader title="Réinitialiser le mot de passe" /><ResetPasswordForm userId={u.id} /></Card>
        </div>
        <Card>
          <CardHeader title="Formulaires affectés" description={u.role === "ADMIN" ? "Un administrateur accède à tous les formulaires." : u.role === "AGENT" ? "Formulaires sur lesquels cet agent peut saisir." : "Formulaires dont ce superviseur suit et valide les réponses."} />
          {u.role !== "ADMIN" && <UserAssignmentsForm userId={u.id} forms={forms.map((f) => ({ id: f.id, code: f.code, title: f.title }))} assigned={u.assignments.map((a) => a.formId)} />}
        </Card>
      </div>
    </>
  );
}
