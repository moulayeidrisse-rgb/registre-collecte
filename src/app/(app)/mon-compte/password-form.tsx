"use client";

import { useActionState } from "react";
import { changePasswordAction, type FormState } from "./actions";
import { Alert, Button, FieldError, Label, inputClass } from "@/components/ui";

export function PasswordForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(changePasswordAction, null);
  const fe = state?.fieldErrors ?? {};
  const field = (name: string, label: string, autoComplete: string) => (
    <div>
      <Label htmlFor={name} required>{label}</Label>
      <input id={name} name={name} type="password" required autoComplete={autoComplete} className={inputClass} aria-invalid={Boolean(fe[name])} aria-describedby={fe[name] ? `${name}-err` : undefined} />
      <FieldError id={`${name}-err`} messages={fe[name]} />
    </div>
  );
  return (
    <form action={action} className="max-w-md space-y-4">
      {state && <Alert tone={state.ok ? "success" : "danger"}>{state.message}</Alert>}
      {field("currentPassword", "Mot de passe actuel", "current-password")}
      {field("newPassword", "Nouveau mot de passe", "new-password")}
      <p className="-mt-2 text-xs text-muted">10 caractères minimum, avec au moins une lettre et un chiffre.</p>
      {field("confirmPassword", "Confirmation du nouveau mot de passe", "new-password")}
      <Button type="submit" disabled={pending}>{pending ? "Enregistrement…" : "Changer le mot de passe"}</Button>
    </form>
  );
}
