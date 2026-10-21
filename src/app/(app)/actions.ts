"use server";

import { redirect } from "next/navigation";
import { logout } from "@/server/services/auth";
import { clearSessionCookie, getClientInfo, getCurrentUser, getSessionToken } from "@/server/auth/session";

export async function logoutAction() {
  const user = await getCurrentUser();
  const { ipAddress } = await getClientInfo();
  await logout(await getSessionToken(), user?.id, ipAddress);
  await clearSessionCookie();
  redirect("/connexion?deconnecte=1");
}
