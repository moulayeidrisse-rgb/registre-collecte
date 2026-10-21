import { notFound } from "next/navigation";
import { requirePagePermission } from "@/server/auth/session";
import { NotFoundError } from "@/server/errors";
import { getFormVersionForDisplay } from "@/server/services/forms";
import { Alert, Card, EmptyState, PageHeader } from "@/components/ui";
import { PreviewForm } from "./preview-form";
import { getT } from "@/i18n/server";

export async function generateMetadata() {
  return { title: (await getT())("Aperçu du formulaire") };
}

export default async function PreviewPage({ params, searchParams }: PageProps<"/formulaires/[id]/apercu">) {
  const user = await requirePagePermission("form:view");
  const t = await getT();
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
        t={t}
        title={t("Aperçu — {title}", { title: data.form.title })}
        breadcrumb={[{ href: "/formulaires", label: t("Formulaires") }, { href: `/formulaires/${id}`, label: data.form.code }]}
        description={data.version ? t("Version {n} ({status}). Vous pouvez tester les règles de validation : rien n'est enregistré.", { n: data.version.number, status: data.version.status === "BROUILLON" ? t("brouillon") : t("publiée") }) : undefined}
      />
      {!data.version || data.fields.length === 0 ? (
        <Card><EmptyState title={t("Aucune question")} description={t("Ajoutez des questions au formulaire pour le prévisualiser.")} /></Card>
      ) : (
        <Card className="max-w-3xl">
          <div className="p-5">
            <Alert tone="info" className="mb-6">{t("Mode aperçu : les contrôles sont exécutés dans le navigateur avec les mêmes règles que le serveur.")}</Alert>
            <PreviewForm fields={data.fields} rules={data.rules} />
          </div>
        </Card>
      )}
    </>
  );
}
