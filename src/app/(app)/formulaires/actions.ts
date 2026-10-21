"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { requireActor } from "@/server/auth/session";
import { toActionError } from "@/server/errors";
import { createForm, publishForm, saveFormDraft, setFormActive, setFormAssignments, startNewVersion } from "@/server/services/forms";
import { rescanForm } from "@/server/services/quality";

export type ActionState = { ok: boolean; message?: string; fieldErrors?: Record<string, string[]> } | null;

export async function createFormAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  let id: string;
  try {
    const actor = await requireActor("form:manage");
    const form = await createForm(actor, {
      code: String(fd.get("code") ?? ""),
      title: String(fd.get("title") ?? ""),
      description: String(fd.get("description") ?? ""),
    });
    id = form.id;
  } catch (e) {
    return toActionError(e);
  }
  redirect(`/formulaires/${id}/modifier?cree=1`);
}

export async function saveFormDraftAction(formId: string, payload: unknown): Promise<ActionState> {
  try {
    const actor = await requireActor("form:manage");
    await saveFormDraft(actor, formId, payload);
    return { ok: true, message: "Brouillon du formulaire enregistré." };
  } catch (e) {
    return toActionError(e);
  }
}

export async function publishFormAction(formId: string): Promise<ActionState> {
  try {
    const actor = await requireActor("form:manage");
    const v = await publishForm(actor, formId);
    refresh();
    return { ok: true, message: `Version ${v.number} publiée : le formulaire est disponible pour la collecte.` };
  } catch (e) {
    return toActionError(e);
  }
}

export async function startNewVersionAction(formId: string): Promise<ActionState> {
  try {
    const actor = await requireActor("form:manage");
    await startNewVersion(actor, formId);
  } catch (e) {
    return toActionError(e);
  }
  redirect(`/formulaires/${formId}/modifier`);
}

export async function setFormActiveAction(formId: string, active: boolean): Promise<ActionState> {
  try {
    const actor = await requireActor("form:manage");
    await setFormActive(actor, formId, active);
    refresh();
    return { ok: true, message: active ? "Formulaire réactivé." : "Formulaire désactivé : la saisie est suspendue." };
  } catch (e) {
    return toActionError(e);
  }
}

export async function setAssignmentsAction(formId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const actor = await requireActor("form:manage");
    const ids = fd.getAll("userIds").map(String).slice(0, 1000);
    await setFormAssignments(actor, formId, ids);
    refresh();
    return { ok: true, message: "Affectations enregistrées." };
  } catch (e) {
    return toActionError(e);
  }
}

export async function rescanAction(formId: string): Promise<ActionState> {
  try {
    const actor = await requireActor("quality:rescan");
    const n = await rescanForm(actor, formId);
    refresh();
    return { ok: true, message: `Contrôle qualité relancé sur ${n} réponse(s).` };
  } catch (e) {
    return toActionError(e);
  }
}
