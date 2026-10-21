import { requirePagePermission } from "@/server/auth/session";
import { Card, PageHeader } from "@/components/ui";
import { CreateForm } from "./create-form";

export const metadata = { title: "Nouveau formulaire" };

export default async function NewFormPage() {
  await requirePagePermission("form:manage");
  return (
    <>
      <PageHeader title="Nouveau formulaire" breadcrumb={[{ href: "/formulaires", label: "Formulaires" }]} description="Le formulaire est créé en brouillon ; vous pourrez ensuite ajouter des questions et le publier." />
      <Card className="max-w-2xl"><CreateForm /></Card>
    </>
  );
}
