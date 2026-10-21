import { notFound } from "next/navigation";
import { requirePagePermission } from "@/server/auth/session";
import { NotFoundError } from "@/server/errors";
import { getUser } from "@/server/services/users";
import { listForms } from "@/server/services/forms";
import { Alert, Card, CardHeader, PageHeader } from "@/components/ui";
import { RoleBadge } from "@/components/status";
import { formatDateTime } from "@/lib/format";
import { EditUserForm, ResetPasswordForm, UserAssignmentsForm } from "../user-forms";
import { getT } from "@/i18n/server";

export async function generateMetadata() {
  return { title: (await getT())("Utilisateur") };
}

export default async function UserPage({ params, searchParams }: PageProps<"/utilisateurs/[id]">) {
  const actor = await requirePagePermission("user:manage");
  const t = await getT();
  const { id } = await params;
  const sp = await searchParams;
  const u = await getUser(actor, id).catch((e) => {
    if (e instanceof NotFoundError) notFound();
    throw e;
  });
  const forms = u.role === "ADMIN" ? [] : await listForms(actor);
  return (
    <>
      <PageHeader t={t} title={u.name} breadcrumb={[{ href: "/utilisateurs", label: t("Utilisateurs") }]} description={<span className="flex flex-wrap items-center gap-2"><span className="break-all" dir="ltr">{u.email}</span><RoleBadge role={u.role} t={t} /><span>{t("Dernière connexion : {date}", { date: formatDateTime(u.lastLoginAt, t.locale) })}</span></span>} />
      {sp.cree && <Alert tone="success" className="mb-6">{t("Compte créé. Affectez-lui maintenant des formulaires si nécessaire.")}</Alert>}
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <Card><CardHeader title={t("Profil et rôle")} /><EditUserForm user={u} /></Card>
          <Card><CardHeader title={t("Réinitialiser le mot de passe")} /><ResetPasswordForm userId={u.id} /></Card>
        </div>
        <Card>
          <CardHeader title={t("Formulaires affectés")} description={u.role === "ADMIN" ? t("Un administrateur accède à tous les formulaires.") : u.role === "AGENT" ? t("Formulaires sur lesquels cet agent peut saisir.") : t("Formulaires dont ce superviseur suit et valide les réponses.")} />
          {u.role !== "ADMIN" && <UserAssignmentsForm userId={u.id} forms={forms.map((f) => ({ id: f.id, code: f.code, title: f.title }))} assigned={u.assignments.map((a) => a.formId)} />}
        </Card>
      </div>
    </>
  );
}
