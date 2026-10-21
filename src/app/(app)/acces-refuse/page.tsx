import { ShieldAlert } from "lucide-react";
import { ButtonLink, EmptyState } from "@/components/ui";
import { getT } from "@/i18n/server";

export async function generateMetadata() {
  return { title: (await getT())("Accès refusé") };
}

export default async function AccessDenied() {
  const t = await getT();
  return (
    <EmptyState
      icon={<ShieldAlert className="h-6 w-6" aria-hidden />}
      level={1}
      title={t("Accès refusé")}
      description={t("Votre rôle ne vous permet pas d'accéder à cette page. Si vous pensez qu'il s'agit d'une erreur, contactez un administrateur.")}
      action={<ButtonLink href="/tableau-de-bord" variant="secondary">{t("Retour au tableau de bord")}</ButtonLink>}
    />
  );
}
