import { requirePagePermission } from "@/server/auth/session";
import { Card, PageHeader } from "@/components/ui";
import { CreateUserForm } from "../user-forms";

export const metadata = { title: "Nouvel utilisateur" };

export default async function NewUserPage() {
  await requirePagePermission("user:manage");
  return (
    <>
      <PageHeader title="Nouvel utilisateur" breadcrumb={[{ href: "/utilisateurs", label: "Utilisateurs" }]} />
      <Card className="max-w-xl"><CreateUserForm /></Card>
    </>
  );
}
