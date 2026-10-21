import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { z } from "zod";
import { prisma } from "../db";
import { assertCan, type SessionUser } from "../auth/permissions";
import { AppError, NotFoundError, ValidationError } from "../errors";
import { checkPasswordPolicy, hashPassword } from "../auth/password";
import { audit } from "./audit";

const roleSchema = z.enum(["ADMIN", "SUPERVISEUR", "AGENT"]);

const createSchema = z.object({
  email: z.string().trim().toLowerCase().email("Adresse électronique invalide").max(200),
  name: z.string().trim().min(2, "Le nom doit contenir au moins 2 caractères").max(120),
  role: roleSchema,
  password: z.string(),
});

const updateSchema = z.object({
  name: z.string().trim().min(2, "Le nom doit contenir au moins 2 caractères").max(120),
  role: roleSchema,
  isActive: z.boolean(),
});

const publicUserSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  isActive: true,
  mustChangePassword: true,
  lastLoginAt: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

export async function listUsers(actor: SessionUser, filters: { q?: string; role?: string } = {}) {
  assertCan(actor, "user:manage");
  const where: Prisma.UserWhereInput = {};
  if (filters.q) where.OR = [{ name: { contains: filters.q, mode: "insensitive" } }, { email: { contains: filters.q, mode: "insensitive" } }];
  if (filters.role && roleSchema.safeParse(filters.role).success) where.role = filters.role as "ADMIN";
  return prisma.user.findMany({
    where,
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    select: { ...publicUserSelect, _count: { select: { assignments: true, submissions: true } } },
  });
}

export async function getUser(actor: SessionUser, userId: string) {
  assertCan(actor, "user:manage");
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { ...publicUserSelect, assignments: { select: { formId: true } } },
  });
  if (!user) throw new NotFoundError("Utilisateur introuvable.");
  return user;
}

export async function createUser(actor: SessionUser, input: { email: string; name: string; role: string; password: string }) {
  assertCan(actor, "user:manage");
  const parsed = createSchema.safeParse(input);
  const fieldErrors: Record<string, string[]> = {};
  if (!parsed.success) for (const i of parsed.error.issues) (fieldErrors[String(i.path[0])] ??= []).push(i.message);
  const policy = checkPasswordPolicy(input.password ?? "");
  if (policy) (fieldErrors.password ??= []).push(policy);
  if (!parsed.success || policy) throw new ValidationError("Veuillez corriger les champs signalés.", fieldErrors);

  try {
    const user = await prisma.user.create({
      data: {
        email: parsed.data.email,
        name: parsed.data.name,
        role: parsed.data.role,
        passwordHash: await hashPassword(parsed.data.password),
        mustChangePassword: true,
      },
      select: publicUserSelect,
    });
    await audit({ actorId: actor.id, action: "user.create", entityType: "User", entityId: user.id, metadata: { email: user.email, role: user.role } });
    return user;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new ValidationError("Cette adresse est déjà utilisée.", { email: ["Adresse déjà utilisée."] });
    }
    throw e;
  }
}

export async function updateUser(actor: SessionUser, userId: string, input: { name: string; role: string; isActive: boolean }) {
  assertCan(actor, "user:manage");
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const i of parsed.error.issues) (fieldErrors[String(i.path[0])] ??= []).push(i.message);
    throw new ValidationError("Veuillez corriger les champs signalés.", fieldErrors);
  }
  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) throw new NotFoundError("Utilisateur introuvable.");

  if (userId === actor.id && (parsed.data.role !== "ADMIN" || !parsed.data.isActive)) {
    throw new AppError("Vous ne pouvez pas retirer votre propre rôle d'administrateur ni désactiver votre compte.");
  }
  if (target.role === "ADMIN" && (parsed.data.role !== "ADMIN" || !parsed.data.isActive)) {
    const otherAdmins = await prisma.user.count({ where: { role: "ADMIN", isActive: true, id: { not: userId } } });
    if (otherAdmins === 0) throw new AppError("Au moins un administrateur actif doit être conservé.");
  }

  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.user.update({ where: { id: userId }, data: parsed.data, select: publicUserSelect });
    // désactivation ou changement de rôle : fermeture immédiate des sessions
    if (!parsed.data.isActive || parsed.data.role !== target.role) await tx.session.deleteMany({ where: { userId } });
    // un administrateur n'a pas besoin d'affectations
    if (parsed.data.role === "ADMIN") await tx.formAssignment.deleteMany({ where: { userId } });
    return u;
  });
  await audit({
    actorId: actor.id,
    action: "user.update",
    entityType: "User",
    entityId: userId,
    metadata: { before: { role: target.role, isActive: target.isActive, name: target.name }, after: parsed.data },
  });
  return updated;
}

export async function resetUserPassword(actor: SessionUser, userId: string, newPassword: string) {
  assertCan(actor, "user:manage");
  const policy = checkPasswordPolicy(newPassword);
  if (policy) throw new ValidationError(policy, { password: [policy] });
  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) throw new NotFoundError("Utilisateur introuvable.");
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(newPassword), mustChangePassword: true } }),
    prisma.session.deleteMany({ where: { userId } }),
  ]);
  await audit({ actorId: actor.id, action: "user.password_reset", entityType: "User", entityId: userId });
}

export async function setUserAssignments(actor: SessionUser, userId: string, formIds: string[]) {
  assertCan(actor, "user:manage");
  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) throw new NotFoundError("Utilisateur introuvable.");
  if (target.role === "ADMIN") throw new AppError("Un administrateur a accès à tous les formulaires : aucune affectation nécessaire.");
  const forms = await prisma.form.findMany({ where: { id: { in: [...new Set(formIds)] } }, select: { id: true } });
  const ids = forms.map((f) => f.id);
  await prisma.$transaction([
    prisma.formAssignment.deleteMany({ where: { userId, formId: { notIn: ids } } }),
    prisma.formAssignment.createMany({ data: ids.map((formId) => ({ formId, userId })), skipDuplicates: true }),
  ]);
  await audit({ actorId: actor.id, action: "user.assignments", entityType: "User", entityId: userId, metadata: { forms: ids.length } });
}

export async function listAssignableUsers(actor: SessionUser) {
  assertCan(actor, "form:manage");
  return prisma.user.findMany({
    where: { role: { in: ["AGENT", "SUPERVISEUR"] }, isActive: true },
    orderBy: [{ role: "asc" }, { name: "asc" }],
    select: { id: true, name: true, email: true, role: true },
  });
}
