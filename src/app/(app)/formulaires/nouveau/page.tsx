import { requirePagePermission } from "@/server/auth/session";
import { Card, PageHeader } from "@/components/ui";
import { CreateForm } from "./create-form";
import { getT } from "@/i18n/server";

export async function generateMetadata() {
  return { title: (await getT())("Nouveau formulaire") };
}

export default async function NewFormPage() {
  await requirePagePermission("form:manage");
  const t = await getT();
  return (
    <>
      <PageHeader t={t} title={t("Nouveau formulaire")} breadcrumb={[{ href: "/formulaires", label: t("Formulaires") }]} description={t("Le formulaire est créé en brouillon ; vous pourrez ensuite ajouter des questions et le publier.")} />
      <Card className="max-w-2xl"><CreateForm /></Card>
    </>
  );
}
