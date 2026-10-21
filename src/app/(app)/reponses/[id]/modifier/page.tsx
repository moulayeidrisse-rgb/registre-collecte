import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/server/auth/session";
import { NotFoundError } from "@/server/errors";
import { getSubmissionDetail } from "@/server/services/submissions";
import { Alert, Card, PageHeader } from "@/components/ui";
import { EntryForm } from "@/components/forms/entry-form";

export const metadata = { title: "Modifier la réponse" };

export default async function EditResponsePage({ params }: PageProps<"/reponses/[id]/modifier">) {
  const user = await requireUser();
  const { id } = await params;
  const d = await getSubmissionDetail(user, id).catch((e) => {
    if (e instanceof NotFoundError) notFound();
    throw e;
  });
  // Contrôle serveur : la page n'est accessible que si la modification est autorisée
  if (!d.canEdit) redirect(`/reponses/${id}`);
  const s = d.submission;
  return (
    <>
      <PageHeader title={`${s.status === "BROUILLON" ? "Reprendre" : "Corriger"} la réponse ${s.reference}`} breadcrumb={[{ href: "/reponses", label: "Réponses" }, { href: `/reponses/${id}`, label: s.reference }]} description={`${d.form.title} · version ${s.version.number}`} />
      {s.status === "A_CORRIGER" && s.reviewComment && <Alert tone="warning" className="mb-6 max-w-3xl" title="Correction demandée">{s.reviewComment}</Alert>}
      {s.status === "SOUMISE" && <Alert tone="info" className="mb-6 max-w-3xl">Cette réponse est déjà soumise : vos corrections seront enregistrées en la soumettant à nouveau.</Alert>}
      <Card className="max-w-3xl">
        <div className="p-5">
          <EntryForm formId={s.formId} submissionId={s.id} fields={d.fields} rules={d.rules} initialValues={d.values} allowDraft={s.status !== "SOUMISE"} />
        </div>
      </Card>
    </>
  );
}
