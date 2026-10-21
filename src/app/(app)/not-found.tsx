"use client";

import { ButtonLink, EmptyState } from "@/components/ui";
import { useT } from "@/i18n/client";

export default function NotFound() {
  const t = useT();
  return (
    <EmptyState
      level={1}
      title={t("Page introuvable")}
      description={t("L'élément demandé n'existe pas ou vous n'avez pas les droits pour le consulter.")}
      action={<ButtonLink href="/tableau-de-bord" variant="secondary">{t("Retour au tableau de bord")}</ButtonLink>}
    />
  );
}
