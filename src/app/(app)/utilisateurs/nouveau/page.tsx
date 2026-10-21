import { requirePagePermission } from "@/server/auth/session";
import { Card, PageHeader } from "@/components/ui";
import { CreateUserForm } from "../user-forms";
import { getT } from "@/i18n/server";

export async function generateMetadata() {
  return { title: (await getT())("Nouvel utilisateur") };
}

export default async function NewUserPage() {
  await requirePagePermission("user:manage");
  const t = await getT();
  return (
    <>
      <PageHeader t={t} title={t("Nouvel utilisateur")} breadcrumb={[{ href: "/utilisateurs", label: t("Utilisateurs") }]} />
      <Card className="max-w-xl"><CreateUserForm /></Card>
    </>
  );
}
