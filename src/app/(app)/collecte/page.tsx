import Link from "next/link";
import { FileText } from "lucide-react";
import { requirePagePermission } from "@/server/auth/session";
import { listAvailableForms } from "@/server/services/submissions";
import { Badge, ButtonLink, Card, EmptyState, PageHeader, withQuery } from "@/components/ui";
import { getT } from "@/i18n/server";

export async function generateMetadata() {
  return { title: (await getT())("Collecte") };
}

export default async function CollectPage() {
  const user = await requirePagePermission("submission:create");
  const t = await getT();
  const forms = await listAvailableForms(user);
  return (
    <>
      <PageHeader t={t} title={t("Collecte")} description={t("Formulaires publiés qui vous sont affectés. Vous pouvez enregistrer un brouillon et le reprendre plus tard.")} actions={<ButtonLink href="/reponses" variant="secondary">{t("Mes réponses")}</ButtonLink>} />
      {forms.length === 0 ? (
        <Card><EmptyState title={t("Aucun formulaire disponible")} description={t("Aucun formulaire publié ne vous est affecté pour le moment. Contactez votre superviseur ou un administrateur.")} /></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {forms.map((f) => (
            <Card key={f.id} className="flex flex-col p-5">
              <div className="flex items-start gap-3">
                <div className="rounded-md bg-primary-50 p-2 text-primary-700"><FileText className="h-5 w-5" aria-hidden /></div>
                <div className="min-w-0">
                  <h2 className="font-semibold leading-snug">{f.title}</h2>
                  <p className="text-xs text-muted">{f.code} · v{f.version} · {t("{n} questions", { n: f.fieldCount })}</p>
                </div>
              </div>
              {f.description && <p className="mt-3 line-clamp-3 text-sm text-muted">{f.description}</p>}
              <div className="mt-3 flex flex-wrap gap-1.5">
                <Badge>{t("{n} soumise(s)", { n: f.mySubmitted })}</Badge>
                {f.myDrafts > 0 && <Link href={withQuery("/reponses", { formId: f.id, status: "BROUILLON" })}><Badge tone="info">{t("{n} brouillon(s)", { n: f.myDrafts })}</Badge></Link>}
                {f.myToFix > 0 && <Link href={withQuery("/reponses", { formId: f.id, status: "A_CORRIGER" })}><Badge tone="warning">{t("{n} à corriger", { n: f.myToFix })}</Badge></Link>}
              </div>
              <div className="mt-auto pt-4">
                <ButtonLink href={`/collecte/${f.id}`} className="w-full">{t("Nouvelle réponse")}</ButtonLink>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
