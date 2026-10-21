import { notFound } from "next/navigation";
import { requirePagePermission } from "@/server/auth/session";
import { NotFoundError } from "@/server/errors";
import { getFormVersionForDisplay } from "@/server/services/forms";
import { Alert, Card, EmptyState, PageHeader } from "@/components/ui";
import { ActionButton } from "@/components/action-button";
import { startNewVersionAction } from "../../actions";
import { FormBuilder } from "./form-builder";
import { getT } from "@/i18n/server";

export async function generateMetadata() {
  return { title: (await getT())("Modifier le formulaire") };
}

export default async function EditFormPage({ params, searchParams }: PageProps<"/formulaires/[id]/modifier">) {
  const user = await requirePagePermission("form:manage");
  const t = await getT();
  const { id } = await params;
  const sp = await searchParams;
  const data = await getFormVersionForDisplay(user, id, "latest").catch((e) => {
    if (e instanceof NotFoundError) notFound();
    throw e;
  });
  const crumbs = [{ href: "/formulaires", label: t("Formulaires") }, { href: `/formulaires/${id}`, label: data.form.code }];
  const title = t("Modifier — {title}", { title: data.form.title });

  if (!data.version || data.version.status !== "BROUILLON") {
    return (
      <>
        <PageHeader t={t} title={title} breadcrumb={crumbs} />
        <Card>
          <EmptyState
            title={t("La version publiée est figée")}
            description={t("Pour modifier ce formulaire, créez une nouvelle version brouillon. Les réponses déjà saisies restent rattachées à leur version d'origine.")}
            action={<ActionButton action={startNewVersionAction.bind(null, id)} variant="primary">{t("Créer une nouvelle version")}</ActionButton>}
          />
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader t={t} title={title} breadcrumb={crumbs} description={t("Définissez les questions, leurs règles de validation, les règles de cohérence et les critères de doublon.")} />
      {sp.cree && <Alert tone="success" className="mb-6">{t("Formulaire créé. Ajoutez maintenant ses questions.")}</Alert>}
      <FormBuilder
        formId={id}
        versionNumber={data.version.number}
        initial={{ title: data.form.title, description: data.form.description, fields: data.fields, rules: data.rules, duplicateFieldKeys: data.form.duplicateFieldKeys }}
      />
    </>
  );
}
