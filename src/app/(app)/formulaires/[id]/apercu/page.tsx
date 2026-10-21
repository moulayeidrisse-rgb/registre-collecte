import { notFound } from "next/navigation";
import { requirePagePermission } from "@/server/auth/session";
import { NotFoundError } from "@/server/errors";
import { getFormVersionForDisplay } from "@/server/services/forms";
import { Alert, Card, EmptyState, PageHeader } from "@/components/ui";
import { PreviewForm } from "./preview-form";

export const metadata = { title: "Aperçu du formulaire" };

export default async function PreviewPage({ params, searchParams }: PageProps<"/formulaires/[id]/apercu">) {
  const user = await requirePagePermission("form:view");
  const { id } = await params;
  const sp = await searchParams;
  const which = sp.version === "publiee" ? "published" : "latest";
  const data = await getFormVersionForDisplay(user, id, which).catch((e) => {
    if (e instanceof NotFoundError) notFound();
    throw e;
  });

  return (
    <>
      <PageHeader
        title={`Aperçu — ${data.form.title}`}
        breadcrumb={[{ href: "/formulaires", label: "Formulaires" }, { href: `/formulaires/${id}`, label: data.form.code }]}
        description={data.version ? `Version ${data.version.number} (${data.version.status === "BROUILLON" ? "brouillon" : "publiée"}). Vous pouvez tester les règles de validation : rien n'est enregistré.` : undefined}
      />
      {!data.version || data.fields.length === 0 ? (
        <Card><EmptyState title="Aucune question" description="Ajoutez des questions au formulaire pour le prévisualiser." /></Card>
      ) : (
        <Card className="max-w-3xl">
          <div className="p-5">
            <Alert tone="info" className="mb-6">Mode aperçu : les contrôles sont exécutés dans le navigateur avec les mêmes règles que le serveur.</Alert>
            <PreviewForm fields={data.fields} rules={data.rules} />
          </div>
        </Card>
      )}
    </>
  );
}
