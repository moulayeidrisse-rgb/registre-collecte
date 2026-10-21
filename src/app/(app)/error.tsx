"use client";

import { Alert, Button } from "@/components/ui";
import { useT } from "@/i18n/client";

// Message générique : aucun détail technique n'est affiché à l'utilisateur
export default function AppError({ reset, error }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useT();
  return (
    <div className="mx-auto max-w-xl py-10">
      <Alert tone="danger" title={t("Une erreur est survenue")}>
        <p>{t("L'opération n'a pas pu aboutir. Réessayez ; si le problème persiste, contactez l'administrateur.")}</p>
        {error.digest && <p className="mt-2 text-xs opacity-75">{t("Référence technique :")} {error.digest}</p>}
      </Alert>
      <Button className="mt-4" variant="secondary" onClick={reset}>{t("Réessayer")}</Button>
    </div>
  );
}
