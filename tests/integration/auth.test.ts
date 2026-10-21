import { describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import { login, logout, validateSessionToken, MAX_FAILED_PER_EMAIL } from "@/server/services/auth";
import { hashToken } from "@/server/auth/tokens";
import { makeUser, PASSWORD } from "./helpers";

describe("authentification", () => {
  it("le mot de passe est stocké haché (argon2id), jamais en clair", async () => {
    const u = await makeUser("AGENT", "Agent Un");
    const row = await prisma.user.findUniqueOrThrow({ where: { id: u.id } });
    expect(row.passwordHash).not.toContain(PASSWORD);
    expect(row.passwordHash.startsWith("$argon2id$")).toBe(true);
  });

  it("connexion réussie : session en base avec hachage du jeton uniquement", async () => {
    const u = await makeUser("AGENT", "Agent Un");
    const { token } = await login(u.email.toUpperCase(), PASSWORD, { ipAddress: "10.0.0.1" });
    const sessions = await prisma.session.findMany({ where: { userId: u.id } });
    expect(sessions).toHaveLength(1);
    expect(sessions[0].tokenHash).toBe(hashToken(token));
    expect(sessions[0].tokenHash).not.toBe(token);
    expect((await validateSessionToken(token))?.id).toBe(u.id);
    expect(await prisma.auditLog.count({ where: { action: "auth.login", actorId: u.id } })).toBe(1);
  });

  it("message générique pour mauvais mot de passe, utilisateur inconnu ou compte inactif", async () => {
    const u = await makeUser("AGENT", "Agent Un");
    const inactive = await makeUser("AGENT", "Agent Inactif", { isActive: false });
    await expect(login(u.email, "mauvais-mdp-123")).rejects.toThrow("Identifiants incorrects ou compte inactif.");
    await expect(login("inconnu@exemple.test", PASSWORD)).rejects.toThrow("Identifiants incorrects ou compte inactif.");
    await expect(login(inactive.email, PASSWORD)).rejects.toThrow("Identifiants incorrects ou compte inactif.");
  });

  it("bloque après trop d'échecs, même avec le bon mot de passe", async () => {
    const u = await makeUser("AGENT", "Agent Un");
    for (let i = 0; i < MAX_FAILED_PER_EMAIL; i++) await expect(login(u.email, "faux-mot-de-passe1")).rejects.toThrow();
    await expect(login(u.email, PASSWORD)).rejects.toThrow(/Trop de tentatives/);
  });

  it("session expirée ou utilisateur désactivé → invalide ; déconnexion supprime la session", async () => {
    const u = await makeUser("AGENT", "Agent Un");
    const { token } = await login(u.email, PASSWORD);
    await prisma.session.updateMany({ where: { userId: u.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect(await validateSessionToken(token)).toBeNull();

    const s2 = await login(u.email, PASSWORD);
    await prisma.user.update({ where: { id: u.id }, data: { isActive: false } });
    expect(await validateSessionToken(s2.token)).toBeNull();

    await prisma.user.update({ where: { id: u.id }, data: { isActive: true } });
    const s3 = await login(u.email, PASSWORD);
    await logout(s3.token, u.id);
    expect(await validateSessionToken(s3.token)).toBeNull();
    expect(await validateSessionToken("jeton-invente")).toBeNull();
  });
});
