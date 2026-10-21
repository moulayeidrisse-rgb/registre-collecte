"use client";

import { useActionState } from "react";
import { createUserAction, resetPasswordAction, updateUserAction, userAssignmentsAction, type ActionState } from "./actions";
import { Alert, Button, ButtonLink, FieldError, Label, inputClass } from "@/components/ui";
import { ROLE_LABELS } from "@/lib/labels";
import { useT } from "@/i18n/client";

function RoleSelect({ defaultValue, invalid }: { defaultValue?: string; invalid?: boolean }) {
  const t = useT();
  return (
    <select id="role" name="role" defaultValue={defaultValue ?? "AGENT"} className={inputClass} aria-invalid={invalid}>
      {Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{t(v)}</option>)}
    </select>
  );
}

export function CreateUserForm() {
  const [s, action, pending] = useActionState<ActionState, FormData>(createUserAction, null);
  const t = useT();
  const fe = s?.fieldErrors ?? {};
  const rq = t("(obligatoire)");
  return (
    <form action={action} className="space-y-4 p-5">
      {s && !s.ok && <Alert tone="danger">{t.msg(s.message ?? "")}</Alert>}
      <div><Label htmlFor="name" required requiredText={rq}>{t("Nom complet")}</Label><input id="name" name="name" required className={inputClass} aria-invalid={Boolean(fe.name)} /><FieldError messages={fe.name?.map(t.msg)} /></div>
      <div><Label htmlFor="email" required requiredText={rq}>{t("Adresse électronique")}</Label><input id="email" name="email" type="email" dir="ltr" required className={inputClass} aria-invalid={Boolean(fe.email)} /><FieldError messages={fe.email?.map(t.msg)} /></div>
      <div><Label htmlFor="role" required requiredText={rq}>{t("Rôle")}</Label><RoleSelect invalid={Boolean(fe.role)} /></div>
      <div>
        <Label htmlFor="password" required requiredText={rq}>{t("Mot de passe provisoire")}</Label>
        <input id="password" name="password" type="password" dir="ltr" autoComplete="new-password" required className={inputClass} aria-invalid={Boolean(fe.password)} />
        <p className="mt-1 text-xs text-muted">{t("10 caractères minimum, au moins une lettre et un chiffre. L'utilisateur devra le changer à sa première connexion.")}</p>
        <FieldError messages={fe.password?.map(t.msg)} />
      </div>
      <div className="flex gap-2"><Button type="submit" disabled={pending}>{pending ? t("Création…") : t("Créer le compte")}</Button><ButtonLink href="/utilisateurs" variant="secondary">{t("Annuler")}</ButtonLink></div>
    </form>
  );
}

export function EditUserForm({ user }: { user: { id: string; name: string; role: string; isActive: boolean } }) {
  const [s, action, pending] = useActionState<ActionState, FormData>(updateUserAction.bind(null, user.id), null);
  const t = useT();
  const fe = s?.fieldErrors ?? {};
  const rq = t("(obligatoire)");
  return (
    <form action={action} className="space-y-4 p-5">
      {s && <Alert tone={s.ok ? "success" : "danger"}>{t.msg(s.message ?? "")}</Alert>}
      <div><Label htmlFor="name" required requiredText={rq}>{t("Nom complet")}</Label><input id="name" name="name" defaultValue={user.name} required className={inputClass} /><FieldError messages={fe.name?.map(t.msg)} /></div>
      <div><Label htmlFor="role" required requiredText={rq}>{t("Rôle")}</Label><RoleSelect defaultValue={user.role} /></div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isActive" defaultChecked={user.isActive} /> {t("Compte actif")}</label>
      <Button type="submit" disabled={pending}>{pending ? t("Enregistrement…") : t("Enregistrer")}</Button>
    </form>
  );
}

export function ResetPasswordForm({ userId }: { userId: string }) {
  const [s, action, pending] = useActionState<ActionState, FormData>(resetPasswordAction.bind(null, userId), null);
  const t = useT();
  return (
    <form action={action} className="space-y-3 p-5">
      {s && <Alert tone={s.ok ? "success" : "danger"}>{t.msg(s.message ?? "")}</Alert>}
      <div><Label htmlFor="newpwd" required requiredText={t("(obligatoire)")}>{t("Nouveau mot de passe provisoire")}</Label><input id="newpwd" name="password" type="password" dir="ltr" autoComplete="new-password" required className={inputClass} /></div>
      <Button type="submit" variant="secondary" disabled={pending}>{t("Réinitialiser")}</Button>
    </form>
  );
}

export function UserAssignmentsForm({ userId, forms, assigned }: { userId: string; forms: { id: string; code: string; title: string }[]; assigned: string[] }) {
  const [s, action, pending] = useActionState<ActionState, FormData>(userAssignmentsAction.bind(null, userId), null);
  const t = useT();
  return (
    <form action={action} className="space-y-3 p-5">
      {s && <Alert tone={s.ok ? "success" : "danger"}>{t.msg(s.message ?? "")}</Alert>}
      {forms.length === 0 ? <p className="text-sm text-muted">{t("Aucun formulaire.")}</p> : forms.map((f) => (
        <label key={f.id} className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="formIds" value={f.id} defaultChecked={assigned.includes(f.id)} className="mt-0.5" />
          <span><span className="font-medium">{f.code}</span> — {f.title}</span>
        </label>
      ))}
      <Button type="submit" disabled={pending}>{t("Enregistrer les affectations")}</Button>
    </form>
  );
}
