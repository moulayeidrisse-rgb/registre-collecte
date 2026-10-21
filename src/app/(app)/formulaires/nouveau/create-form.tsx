"use client";

import { useActionState } from "react";
import { createFormAction, type ActionState } from "../actions";
import { Alert, Button, ButtonLink, FieldError, Label, inputClass } from "@/components/ui";
import { useT } from "@/i18n/client";

export function CreateForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(createFormAction, null);
  const t = useT();
  const fe = state?.fieldErrors ?? {};
  const rq = t("(obligatoire)");
  return (
    <form action={action} className="space-y-4 p-5">
      {state && !state.ok && <Alert tone="danger">{t.msg(state.message ?? "")}</Alert>}
      <div>
        <Label htmlFor="code" required requiredText={rq}>{t("Code")}</Label>
        <input id="code" name="code" dir="ltr" required maxLength={30} placeholder="ENQ-2026-01" className={`${inputClass} uppercase`} aria-invalid={Boolean(fe.code)} aria-describedby="code-help code-err" />
        <p id="code-help" className="mt-1 text-xs text-muted">{t("Identifiant court et unique : lettres majuscules, chiffres et tirets.")}</p>
        <FieldError id="code-err" messages={fe.code?.map(t.msg)} />
      </div>
      <div>
        <Label htmlFor="title" required requiredText={rq}>{t("Titre")}</Label>
        <input id="title" name="title" required maxLength={200} className={inputClass} aria-invalid={Boolean(fe.title)} aria-describedby="title-err" />
        <FieldError id="title-err" messages={fe.title?.map(t.msg)} />
      </div>
      <div>
        <Label htmlFor="description">{t("Description")}</Label>
        <textarea id="description" name="description" rows={3} maxLength={2000} className={inputClass} />
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>{pending ? t("Création…") : t("Créer et ajouter des questions")}</Button>
        <ButtonLink href="/formulaires" variant="secondary">{t("Annuler")}</ButtonLink>
      </div>
    </form>
  );
}
