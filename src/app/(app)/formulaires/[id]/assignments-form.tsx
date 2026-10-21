"use client";

import { useActionState } from "react";
import { setAssignmentsAction, type ActionState } from "../actions";
import { Alert, Button } from "@/components/ui";
import { ROLE_LABELS } from "@/lib/labels";

type U = { id: string; name: string; email: string; role: "AGENT" | "SUPERVISEUR" | "ADMIN" };

export function AssignmentsForm({ formId, users, assigned }: { formId: string; users: U[]; assigned: string[] }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(setAssignmentsAction.bind(null, formId), null);
  const groups = (["SUPERVISEUR", "AGENT"] as const).map((r) => ({ role: r, users: users.filter((u) => u.role === r) }));
  return (
    <form action={action} className="space-y-4 p-5">
      {state && <Alert tone={state.ok ? "success" : "danger"}>{state.message}</Alert>}
      {groups.map((g) => (
        <fieldset key={g.role}>
          <legend className="mb-2 text-sm font-medium">{ROLE_LABELS[g.role]}s</legend>
          {g.users.length === 0 ? <p className="text-sm text-muted">Aucun utilisateur actif.</p> : (
            <div className="grid gap-2 sm:grid-cols-2">
              {g.users.map((u) => (
                <label key={u.id} className="flex items-start gap-2 rounded-md border border-line px-3 py-2 text-sm hover:bg-surface">
                  <input type="checkbox" name="userIds" value={u.id} defaultChecked={assigned.includes(u.id)} className="mt-0.5" />
                  <span><span className="font-medium">{u.name}</span><span className="block text-xs text-muted break-all">{u.email}</span></span>
                </label>
              ))}
            </div>
          )}
        </fieldset>
      ))}
      <Button type="submit" disabled={pending}>{pending ? "Enregistrement…" : "Enregistrer les affectations"}</Button>
    </form>
  );
}
