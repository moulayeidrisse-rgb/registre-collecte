"use server";

import { redirect } from "next/navigation";
import { login } from "@/server/services/auth";
import { getClientInfo, setSessionCookie } from "@/server/auth/session";
import { toActionError } from "@/server/errors";

export type LoginState = { ok: boolean; message?: string; email?: string } | null;

/** N'accepte que des chemins internes (évite les redirections ouvertes) */
function safeNext(v: FormDataEntryValue | null): string {
  const s = typeof v === "string" ? v : "";
  return s.startsWith("/") && !s.startsWith("//") && !s.startsWith("/\\") ? s : "/tableau-de-bord";
}

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").slice(0, 200);
  const password = String(formData.get("password") ?? "").slice(0, 200);
  if (!email || !password) return { ok: false, message: "Saisissez votre adresse et votre mot de passe.", email };

  let target: string;
  try {
    const result = await login(email, password, await getClientInfo());
    await setSessionCookie(result.token, result.expiresAt);
    target = result.user.mustChangePassword ? "/mon-compte?changement=obligatoire" : safeNext(formData.get("suite"));
  } catch (e) {
    return { ...toActionError(e), email };
  }
  redirect(target);
}
