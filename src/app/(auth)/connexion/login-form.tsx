"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { loginAction, type LoginState } from "./actions";
import { Alert, Button, Label, inputClass } from "@/components/ui";
import { useT } from "@/i18n/client";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, null);
  const params = useSearchParams();
  const t = useT();
  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="suite" value={params.get("suite") ?? ""} />
      {params.get("deconnecte") && !state && <Alert tone="success">{t("Vous êtes déconnecté.")}</Alert>}
      {params.get("expiree") && !state && <Alert tone="warning">{t("Votre session a expiré. Veuillez vous reconnecter.")}</Alert>}
      {state && !state.ok && <Alert tone="danger">{t.msg(state.message ?? "")}</Alert>}
      <div>
        <Label htmlFor="email">{t("Adresse électronique")}</Label>
        <input id="email" name="email" type="email" dir="ltr" autoComplete="username" required defaultValue={state?.email} className={inputClass} />
      </div>
      <div>
        <Label htmlFor="password">{t("Mot de passe")}</Label>
        <input id="password" name="password" type="password" dir="ltr" autoComplete="current-password" required className={inputClass} />
      </div>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? t("Connexion…") : t("Se connecter")}
      </Button>
    </form>
  );
}
