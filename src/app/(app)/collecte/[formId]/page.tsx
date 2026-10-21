import { notFound } from "next/navigation";
import { requirePagePermission } from "@/server/auth/session";
import { NotFoundError } from "@/server/errors";
import { getFormForEntry } from "@/server/services/submissions";
import { Card, PageHeader } from "@/components/ui";
import { EntryForm } from "@/components/forms/entry-form";
import { getT } from "@/i18n/server";

export async function generateMetadata() {
  return { title: (await getT())("Nouvelle réponse") };
}

export default async function NewEntryPage({ params }: PageProps<"/collecte/[formId]">) {
  const user = await requirePagePermission("submission:create");
  const t = await getT();
  const { formId } = await params;
  const data = await getFormForEntry(user, formId).catch((e) => {
    if (e instanceof NotFoundError) notFound();
    throw e;
  });
  return (
    <>
      <PageHeader t={t} title={data.form.title} breadcrumb={[{ href: "/collecte", label: t("Collecte") }]} description={t("Nouvelle réponse · version {n}. Les champs marqués * sont obligatoires pour soumettre.", { n: data.version.number })} />
      <Card className="max-w-3xl">
        <div className="p-5"><EntryForm formId={formId} fields={data.fields} rules={data.rules} allowDraft /></div>
      </Card>
    </>
  );
}
