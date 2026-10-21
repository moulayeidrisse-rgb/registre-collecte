import { ButtonLink, EmptyState } from "@/components/ui";

export default function NotFound() {
  return (
    <EmptyState
      level={1}
      title="Page introuvable / الصفحة غير موجودة"
      description="L'élément demandé n'existe pas ou vous n'avez pas les droits pour le consulter."
      action={<ButtonLink href="/tableau-de-bord" variant="secondary">Retour au tableau de bord / العودة</ButtonLink>}
    />
  );
}
