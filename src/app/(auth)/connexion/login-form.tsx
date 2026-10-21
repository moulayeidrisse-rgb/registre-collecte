"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { loginAction, type LoginState } from "./actions";
import { Alert, Button, Label, inputClass } from "@/components/ui";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, null);
  const params = useSearchParams();
  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="suite" value={params.get("suite") ?? ""} />
      {params.get("deconnecte") && !state && <Alert tone="success">Vous êtes déconnecté.</Alert>}
      {params.get("expiree") && !state && <Alert tone="warning">Votre session a expiré. Veuillez vous reconnecter.</Alert>}
      {state && !state.ok && <Alert tone="danger">{state.message}</Alert>}
      <div>
        <Label htmlFor="email">Adresse électronique</Label>
        <input id="email" name="email" type="email" autoComplete="username" required defaultValue={state?.email} className={inputClass} />
      </div>
      <div>
        <Label htmlFor="password">Mot de passe</Label>
        <input id="password" name="password" type="password" autoComplete="current-password" required className={inputClass} />
      </div>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Connexion…" : "Se connecter"}
      </Button>
    </form>
  );
}
