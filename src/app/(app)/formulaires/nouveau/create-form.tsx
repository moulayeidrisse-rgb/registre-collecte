"use client";

import { useActionState } from "react";
import { createFormAction, type ActionState } from "../actions";
import { Alert, Button, ButtonLink, FieldError, Label, inputClass } from "@/components/ui";

export function CreateForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(createFormAction, null);
  const fe = state?.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-4 p-5">
      {state && !state.ok && <Alert tone="danger">{state.message}</Alert>}
      <div>
        <Label htmlFor="code" required>Code</Label>
        <input id="code" name="code" required maxLength={30} placeholder="ex. ENQ-2026-01" className={`${inputClass} uppercase`} aria-invalid={Boolean(fe.code)} aria-describedby="code-help code-err" />
        <p id="code-help" className="mt-1 text-xs text-muted">Identifiant court et unique : lettres majuscules, chiffres et tirets.</p>
        <FieldError id="code-err" messages={fe.code} />
      </div>
      <div>
        <Label htmlFor="title" required>Titre</Label>
        <input id="title" name="title" required maxLength={200} className={inputClass} aria-invalid={Boolean(fe.title)} aria-describedby="title-err" />
        <FieldError id="title-err" messages={fe.title} />
      </div>
      <div>
        <Label htmlFor="description">Description</Label>
        <textarea id="description" name="description" rows={3} maxLength={2000} className={inputClass} />
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>{pending ? "Création…" : "Créer et ajouter des questions"}</Button>
        <ButtonLink href="/formulaires" variant="secondary">Annuler</ButtonLink>
      </div>
    </form>
  );
}
