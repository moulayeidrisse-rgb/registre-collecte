import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { validateSessionToken } from "../services/auth";
import { assertCan, can, type Permission, type SessionUser } from "./permissions";
import { UnauthenticatedError } from "../errors";

export const SESSION_COOKIE = "rc_session";

function cookieSecure() {
  if (process.env.COOKIE_SECURE === "false") return false;
  if (process.env.COOKIE_SECURE === "true") return true;
  return process.env.NODE_ENV === "production";
}

export async function setSessionCookie(token: string, expiresAt: Date) {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: cookieSecure(),
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function clearSessionCookie() {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function getSessionToken(): Promise<string | undefined> {
  return (await cookies()).get(SESSION_COOKIE)?.value;
}

/** Utilisateur courant (dédupliqué par requête), ou null. Lit le cookie : à appeler sous <Suspense>. */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  return validateSessionToken(await getSessionToken());
});

/** Pour les pages : redirige vers la connexion si nécessaire */
export async function requireUser(opts: { allowPasswordChange?: boolean } = {}): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/connexion");
  if (user.mustChangePassword && !opts.allowPasswordChange) redirect("/mon-compte?changement=obligatoire");
  return user;
}

/** Pour les pages : exige une permission, sinon page « accès refusé » */
export async function requirePagePermission(permission: Permission): Promise<SessionUser> {
  const user = await requireUser();
  if (!can(user, permission)) redirect("/acces-refuse");
  return user;
}

/** Pour les Server Actions et Route Handlers : lève une erreur au lieu de rediriger */
export async function requireActor(permission?: Permission, opts: { allowPasswordChange?: boolean } = {}): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new UnauthenticatedError();
  if (user.mustChangePassword && !opts.allowPasswordChange) {
    throw new UnauthenticatedError("Vous devez changer votre mot de passe avant de continuer.");
  }
  if (permission) assertCan(user, permission);
  return user;
}

export async function getClientInfo() {
  const h = await headers();
  // x-forwarded-for n'est fiable que derrière un proxy de confiance (voir README)
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
  return { ipAddress: ip, userAgent: h.get("user-agent") };
}
