"use client";

import { useActionState } from "react";
import { createUserAction, resetPasswordAction, updateUserAction, userAssignmentsAction, type ActionState } from "./actions";
import { Alert, Button, ButtonLink, FieldError, Label, inputClass } from "@/components/ui";
import { ROLE_LABELS } from "@/lib/labels";

function RoleSelect({ defaultValue, invalid }: { defaultValue?: string; invalid?: boolean }) {
  return (
    <select id="role" name="role" defaultValue={defaultValue ?? "AGENT"} className={inputClass} aria-invalid={invalid}>
      {Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
    </select>
  );
}

export function CreateUserForm() {
  const [s, action, pending] = useActionState<ActionState, FormData>(createUserAction, null);
  const fe = s?.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-4 p-5">
      {s && !s.ok && <Alert tone="danger">{s.message}</Alert>}
      <div><Label htmlFor="name" required>Nom complet</Label><input id="name" name="name" required className={inputClass} aria-invalid={Boolean(fe.name)} /><FieldError messages={fe.name} /></div>
      <div><Label htmlFor="email" required>Adresse électronique</Label><input id="email" name="email" type="email" required className={inputClass} aria-invalid={Boolean(fe.email)} /><FieldError messages={fe.email} /></div>
      <div><Label htmlFor="role" required>Rôle</Label><RoleSelect invalid={Boolean(fe.role)} /></div>
      <div>
        <Label htmlFor="password" required>Mot de passe provisoire</Label>
        <input id="password" name="password" type="password" autoComplete="new-password" required className={inputClass} aria-invalid={Boolean(fe.password)} />
        <p className="mt-1 text-xs text-muted">10 caractères minimum, au moins une lettre et un chiffre. L&apos;utilisateur devra le changer à sa première connexion.</p>
        <FieldError messages={fe.password} />
      </div>
      <div className="flex gap-2"><Button type="submit" disabled={pending}>{pending ? "Création…" : "Créer le compte"}</Button><ButtonLink href="/utilisateurs" variant="secondary">Annuler</ButtonLink></div>
    </form>
  );
}

export function EditUserForm({ user }: { user: { id: string; name: string; role: string; isActive: boolean } }) {
  const [s, action, pending] = useActionState<ActionState, FormData>(updateUserAction.bind(null, user.id), null);
  const fe = s?.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-4 p-5">
      {s && <Alert tone={s.ok ? "success" : "danger"}>{s.message}</Alert>}
      <div><Label htmlFor="name" required>Nom complet</Label><input id="name" name="name" defaultValue={user.name} required className={inputClass} /><FieldError messages={fe.name} /></div>
      <div><Label htmlFor="role" required>Rôle</Label><RoleSelect defaultValue={user.role} /></div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isActive" defaultChecked={user.isActive} /> Compte actif</label>
      <Button type="submit" disabled={pending}>{pending ? "Enregistrement…" : "Enregistrer"}</Button>
    </form>
  );
}

export function ResetPasswordForm({ userId }: { userId: string }) {
  const [s, action, pending] = useActionState<ActionState, FormData>(resetPasswordAction.bind(null, userId), null);
  return (
    <form action={action} className="space-y-3 p-5">
      {s && <Alert tone={s.ok ? "success" : "danger"}>{s.message}</Alert>}
      <div><Label htmlFor="newpwd" required>Nouveau mot de passe provisoire</Label><input id="newpwd" name="password" type="password" autoComplete="new-password" required className={inputClass} /></div>
      <Button type="submit" variant="secondary" disabled={pending}>Réinitialiser</Button>
    </form>
  );
}

export function UserAssignmentsForm({ userId, forms, assigned }: { userId: string; forms: { id: string; code: string; title: string }[]; assigned: string[] }) {
  const [s, action, pending] = useActionState<ActionState, FormData>(userAssignmentsAction.bind(null, userId), null);
  return (
    <form action={action} className="space-y-3 p-5">
      {s && <Alert tone={s.ok ? "success" : "danger"}>{s.message}</Alert>}
      {forms.length === 0 ? <p className="text-sm text-muted">Aucun formulaire.</p> : forms.map((f) => (
        <label key={f.id} className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="formIds" value={f.id} defaultChecked={assigned.includes(f.id)} className="mt-0.5" />
          <span><span className="font-medium">{f.code}</span> — {f.title}</span>
        </label>
      ))}
      <Button type="submit" disabled={pending}>Enregistrer les affectations</Button>
    </form>
  );
}
