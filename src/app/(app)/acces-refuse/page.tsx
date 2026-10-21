import { ShieldAlert } from "lucide-react";
import { ButtonLink, EmptyState } from "@/components/ui";

export const metadata = { title: "Accès refusé" };

export default function AccessDenied() {
  return (
    <EmptyState
      icon={<ShieldAlert className="h-6 w-6" aria-hidden />}
      level={1}
      title="Accès refusé"
      description="Votre rôle ne vous permet pas d'accéder à cette page. Si vous pensez qu'il s'agit d'une erreur, contactez un administrateur."
      action={<ButtonLink href="/tableau-de-bord" variant="secondary">Retour au tableau de bord</ButtonLink>}
    />
  );
}
