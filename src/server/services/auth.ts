import "server-only";
import { prisma } from "../db";
import { AppError } from "../errors";
import { getDummyHash, verifyPassword, hashPassword, checkPasswordPolicy } from "../auth/password";
import { generateSessionToken, hashToken } from "../auth/tokens";
import type { SessionUser } from "../auth/permissions";
import { audit } from "./audit";
import { ValidationError } from "../errors";

export const LOGIN_WINDOW_MINUTES = 15;
export const MAX_FAILED_PER_EMAIL = 5;
export const MAX_FAILED_PER_IP = 30;

const GENERIC_LOGIN_ERROR = "Identifiants incorrects ou compte inactif.";

export function sessionTtlMs() {
  const h = Number(process.env.SESSION_TTL_HOURS ?? 8);
  return (Number.isFinite(h) && h > 0 ? h : 8) * 3600_000;
}

type ClientInfo = { ipAddress?: string | null; userAgent?: string | null };

/**
 * Vérifie les identifiants et ouvre une session.
 * Retourne le jeton en clair (à placer dans le cookie) ; seul son hachage est stocké.
 */
export async function login(emailInput: string, password: string, client: ClientInfo = {}) {
  const email = emailInput.trim().toLowerCase();
  const since = new Date(Date.now() - LOGIN_WINDOW_MINUTES * 60_000);

  const [failedEmail, failedIp] = await Promise.all([
    prisma.loginAttempt.count({ where: { email, success: false, createdAt: { gte: since } } }),
    client.ipAddress
      ? prisma.loginAttempt.count({ where: { ipAddress: client.ipAddress, success: false, createdAt: { gte: since } } })
      : Promise.resolve(0),
  ]);
  if (failedEmail >= MAX_FAILED_PER_EMAIL || failedIp >= MAX_FAILED_PER_IP) {
    await audit({ action: "auth.login_blocked", metadata: { email }, ipAddress: client.ipAddress });
    throw new AppError(`Trop de tentatives de connexion. Réessayez dans ${LOGIN_WINDOW_MINUTES} minutes.`);
  }

  const user = await prisma.user.findUnique({ where: { email } });
  // Vérification systématique (même si l'utilisateur n'existe pas) pour un temps de réponse homogène
  const ok = await verifyPassword(user?.passwordHash ?? (await getDummyHash()), password);

  if (!user || !ok || !user.isActive) {
    await prisma.loginAttempt.create({ data: { email, ipAddress: client.ipAddress ?? null, success: false } });
    await audit({ actorId: user?.id ?? null, action: "auth.login_failed", metadata: { email }, ipAddress: client.ipAddress });
    throw new AppError(GENERIC_LOGIN_ERROR);
  }

  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + sessionTtlMs());
  await prisma.$transaction([
    prisma.session.create({
      data: {
        tokenHash: hashToken(token),
        userId: user.id,
        expiresAt,
        ipAddress: client.ipAddress ?? null,
        userAgent: client.userAgent?.slice(0, 300) ?? null,
      },
    }),
    prisma.loginAttempt.create({ data: { email, ipAddress: client.ipAddress ?? null, success: true } }),
    prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }),
    // Nettoyage opportuniste des sessions expirées de cet utilisateur
    prisma.session.deleteMany({ where: { userId: user.id, expiresAt: { lt: new Date() } } }),
  ]);
  await audit({ actorId: user.id, action: "auth.login", ipAddress: client.ipAddress });

  return { token, expiresAt, user: { id: user.id, mustChangePassword: user.mustChangePassword } };
}

/** Retourne l'utilisateur associé à un jeton valide, ou null */
export async function validateSessionToken(token: string | undefined | null): Promise<SessionUser | null> {
  if (!token || token.length > 200) return null;
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });
  if (!session) return null;
  if (session.expiresAt.getTime() <= Date.now() || !session.user.isActive) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }
  const u = session.user;
  return { id: u.id, email: u.email, name: u.name, role: u.role, mustChangePassword: u.mustChangePassword };
}

export async function logout(token: string | undefined | null, actorId?: string, ipAddress?: string | null) {
  if (token) await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  if (actorId) await audit({ actorId, action: "auth.logout", ipAddress });
}

/** Changement de mot de passe par l'utilisateur lui-même ; révoque ses autres sessions */
export async function changeOwnPassword(
  actor: SessionUser,
  currentPassword: string,
  newPassword: string,
  keepTokenHash?: string,
) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: actor.id } });
  if (!(await verifyPassword(user.passwordHash, currentPassword))) {
    throw new ValidationError("Le mot de passe actuel est incorrect.", { currentPassword: ["Mot de passe actuel incorrect."] });
  }
  const policy = checkPasswordPolicy(newPassword);
  if (policy) throw new ValidationError(policy, { newPassword: [policy] });
  if (currentPassword === newPassword) {
    throw new ValidationError("Le nouveau mot de passe doit être différent de l'actuel.", { newPassword: ["Doit être différent de l'actuel."] });
  }
  await prisma.$transaction([
    prisma.user.update({ where: { id: actor.id }, data: { passwordHash: await hashPassword(newPassword), mustChangePassword: false } }),
    prisma.session.deleteMany({ where: { userId: actor.id, ...(keepTokenHash ? { tokenHash: { not: keepTokenHash } } : {}) } }),
  ]);
  await audit({ actorId: actor.id, action: "auth.password_changed", entityType: "User", entityId: actor.id });
}
