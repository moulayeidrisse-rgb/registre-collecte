import { notFound } from "next/navigation";
import { requirePagePermission } from "@/server/auth/session";
import { NotFoundError } from "@/server/errors";
import { getFormForEntry } from "@/server/services/submissions";
import { Card, PageHeader } from "@/components/ui";
import { EntryForm } from "@/components/forms/entry-form";

export const metadata = { title: "Nouvelle réponse" };

export default async function NewEntryPage({ params }: PageProps<"/collecte/[formId]">) {
  const user = await requirePagePermission("submission:create");
  const { formId } = await params;
  const data = await getFormForEntry(user, formId).catch((e) => {
    if (e instanceof NotFoundError) notFound();
    throw e;
  });
  return (
    <>
      <PageHeader title={data.form.title} breadcrumb={[{ href: "/collecte", label: "Collecte" }]} description={`Nouvelle réponse · version ${data.version.number}. Les champs marqués * sont obligatoires pour soumettre.`} />
      <Card className="max-w-3xl">
        <div className="p-5"><EntryForm formId={formId} fields={data.fields} rules={data.rules} allowDraft /></div>
      </Card>
    </>
  );
}
