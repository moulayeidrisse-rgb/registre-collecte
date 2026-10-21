"use client";

import { useActionState } from "react";
import { setAssignmentsAction, type ActionState } from "../actions";
import { Alert, Button } from "@/components/ui";
import { useT } from "@/i18n/client";

type U = { id: string; name: string; email: string; role: "AGENT" | "SUPERVISEUR" | "ADMIN" };

export function AssignmentsForm({ formId, users, assigned }: { formId: string; users: U[]; assigned: string[] }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(setAssignmentsAction.bind(null, formId), null);
  const t = useT();
  const groups = [
    { role: "SUPERVISEUR", title: t("Superviseurs"), users: users.filter((u) => u.role === "SUPERVISEUR") },
    { role: "AGENT", title: t("Agents de collecte"), users: users.filter((u) => u.role === "AGENT") },
  ];
  return (
    <form action={action} className="space-y-4 p-5">
      {state && <Alert tone={state.ok ? "success" : "danger"}>{t.msg(state.message ?? "")}</Alert>}
      {groups.map((g) => (
        <fieldset key={g.role}>
          <legend className="mb-2 text-sm font-medium">{g.title}</legend>
          {g.users.length === 0 ? <p className="text-sm text-muted">{t("Aucun utilisateur actif.")}</p> : (
            <div className="grid gap-2 sm:grid-cols-2">
              {g.users.map((u) => (
                <label key={u.id} className="flex items-start gap-2 rounded-md border border-line px-3 py-2 text-sm hover:bg-surface">
                  <input type="checkbox" name="userIds" value={u.id} defaultChecked={assigned.includes(u.id)} className="mt-0.5" />
                  <span><span className="font-medium">{u.name}</span><span className="block text-xs text-muted break-all" dir="ltr">{u.email}</span></span>
                </label>
              ))}
            </div>
          )}
        </fieldset>
      ))}
      <Button type="submit" disabled={pending}>{pending ? t("Enregistrement…") : t("Enregistrer les affectations")}</Button>
    </form>
  );
}
