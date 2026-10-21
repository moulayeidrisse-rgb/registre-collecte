"use client";

import { Alert, Button } from "@/components/ui";

// Message générique : aucun détail technique n'est affiché à l'utilisateur
export default function AppError({ reset, error }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-xl py-10">
      <Alert tone="danger" title="Une erreur est survenue">
        <p>L&apos;opération n&apos;a pas pu aboutir. Réessayez ; si le problème persiste, contactez l&apos;administrateur.</p>
        {error.digest && <p className="mt-2 text-xs opacity-75">Référence technique : {error.digest}</p>}
      </Alert>
      <Button className="mt-4" variant="secondary" onClick={reset}>Réessayer</Button>
    </div>
  );
}
