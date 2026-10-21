"use server";

import { requireActor, getSessionToken } from "@/server/auth/session";
import { changeOwnPassword } from "@/server/services/auth";
import { hashToken } from "@/server/auth/tokens";
import { toActionError } from "@/server/errors";
import { refresh } from "next/cache";

export type FormState = { ok: boolean; message?: string; fieldErrors?: Record<string, string[]> } | null;

export async function changePasswordAction(_prev: FormState, fd: FormData): Promise<FormState> {
  try {
    const actor = await requireActor(undefined, { allowPasswordChange: true });
    const current = String(fd.get("currentPassword") ?? "");
    const next = String(fd.get("newPassword") ?? "");
    const confirm = String(fd.get("confirmPassword") ?? "");
    if (next !== confirm) return { ok: false, message: "La confirmation ne correspond pas.", fieldErrors: { confirmPassword: ["Les deux saisies diffèrent."] } };
    const token = await getSessionToken();
    await changeOwnPassword(actor, current, next, token ? hashToken(token) : undefined);
    refresh();
    return { ok: true, message: "Mot de passe modifié. Vos autres sessions ont été fermées." };
  } catch (e) {
    return toActionError(e);
  }
}
