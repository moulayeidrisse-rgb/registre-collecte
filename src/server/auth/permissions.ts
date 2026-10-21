import "server-only";
import type { Role } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";
import { ForbiddenError } from "../errors";

/** Utilisateur authentifié, tel que connu côté serveur pour la requête en cours */
export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  mustChangePassword: boolean;
};

export const PERMISSIONS = [
  "dashboard:view",
  "form:view",
  "form:manage",
  "submission:create",
  "submission:view_own",
  "submission:view_scope",
  "submission:view_all",
  "submission:review",
  "submission:edit_any",
  "quality:view",
  "quality:rescan",
  "export:csv",
  "report:view",
  "user:manage",
  "audit:view",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

/**
 * Matrice des permissions par rôle (source unique de vérité).
 * - ADMIN : gestion complète.
 * - SUPERVISEUR : suivi, consultation et validation des réponses des formulaires qui lui sont affectés.
 * - AGENT : saisie sur les formulaires qui lui sont affectés, consultation de ses propres réponses.
 */
export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  ADMIN: PERMISSIONS,
  SUPERVISEUR: [
    "dashboard:view",
    "form:view",
    "submission:view_scope",
    "submission:review",
    "quality:view",
    "export:csv",
    "report:view",
  ],
  AGENT: ["dashboard:view", "form:view", "submission:create", "submission:view_own"],
};

export function can(user: Pick<SessionUser, "role"> | null | undefined, permission: Permission): boolean {
  if (!user) return false;
  return ROLE_PERMISSIONS[user.role].includes(permission);
}

export function assertCan(user: Pick<SessionUser, "role">, permission: Permission): void {
  if (!can(user, permission)) throw new ForbiddenError();
}

/** Formulaires visibles par l'acteur (ADMIN : tous ; autres : formulaires affectés) */
export function formScope(user: SessionUser): Prisma.FormWhereInput {
  if (user.role === "ADMIN") return {};
  return { assignments: { some: { userId: user.id } } };
}

/**
 * Réponses visibles par l'acteur.
 * - ADMIN : toutes.
 * - SUPERVISEUR : réponses non brouillon des formulaires affectés.
 * - AGENT : ses propres réponses uniquement.
 */
export function submissionScope(user: SessionUser): Prisma.SubmissionWhereInput {
  if (can(user, "submission:view_all")) return {};
  if (can(user, "submission:view_scope")) {
    return {
      status: { not: "BROUILLON" },
      version: { form: { assignments: { some: { userId: user.id } } } },
    };
  }
  if (can(user, "submission:view_own")) return { agentId: user.id };
  return { id: "__aucun__" };
}
