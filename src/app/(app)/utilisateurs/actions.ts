"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { requireActor } from "@/server/auth/session";
import { toActionError } from "@/server/errors";
import { createUser, resetUserPassword, setUserAssignments, updateUser } from "@/server/services/users";

export type ActionState = { ok: boolean; message?: string; fieldErrors?: Record<string, string[]> } | null;

export async function createUserAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  let id: string;
  try {
    const actor = await requireActor("user:manage");
    const u = await createUser(actor, {
      email: String(fd.get("email") ?? ""),
      name: String(fd.get("name") ?? ""),
      role: String(fd.get("role") ?? ""),
      password: String(fd.get("password") ?? ""),
    });
    id = u.id;
  } catch (e) {
    return toActionError(e);
  }
  redirect(`/utilisateurs/${id}?cree=1`);
}

export async function updateUserAction(userId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const actor = await requireActor("user:manage");
    await updateUser(actor, userId, { name: String(fd.get("name") ?? ""), role: String(fd.get("role") ?? ""), isActive: fd.get("isActive") === "on" });
    refresh();
    return { ok: true, message: "Utilisateur mis à jour." };
  } catch (e) {
    return toActionError(e);
  }
}

export async function resetPasswordAction(userId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const actor = await requireActor("user:manage");
    await resetUserPassword(actor, userId, String(fd.get("password") ?? ""));
    return { ok: true, message: "Mot de passe réinitialisé. L'utilisateur devra le changer à sa prochaine connexion ; ses sessions ont été fermées." };
  } catch (e) {
    return toActionError(e);
  }
}

export async function userAssignmentsAction(userId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const actor = await requireActor("user:manage");
    await setUserAssignments(actor, userId, fd.getAll("formIds").map(String).slice(0, 1000));
    refresh();
    return { ok: true, message: "Affectations enregistrées." };
  } catch (e) {
    return toActionError(e);
  }
}
