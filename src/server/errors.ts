import "server-only";
import type { ValidationIssue } from "@/lib/validation/types";

/** Erreur dont le message peut être montré à l'utilisateur */
export class AppError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AppError";
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Vous n'avez pas les droits nécessaires pour effectuer cette action.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Élément introuvable ou inaccessible.") {
    super(message);
    this.name = "NotFoundError";
  }
}

export class UnauthenticatedError extends AppError {
  constructor(message = "Votre session a expiré. Veuillez vous reconnecter.") {
    super(message);
    this.name = "UnauthenticatedError";
  }
}

export class ValidationError extends AppError {
  constructor(
    message: string,
    public readonly fieldErrors: Record<string, string[]> = {},
    public readonly issues: ValidationIssue[] = [],
  ) {
    super(message);
    this.name = "ValidationError";
  }
}

export type ActionResult<T = undefined> =
  | ({ ok: true; message?: string } & (T extends undefined ? { data?: undefined } : { data: T }))
  | { ok: false; message: string; fieldErrors?: Record<string, string[]>; issues?: ValidationIssue[] };

/**
 * Convertit une exception en résultat d'action sans divulguer de détail interne.
 * Les erreurs inattendues sont journalisées côté serveur uniquement.
 */
export function toActionError(e: unknown): { ok: false; message: string; fieldErrors?: Record<string, string[]>; issues?: ValidationIssue[] } {
  if (e instanceof ValidationError) {
    return { ok: false, message: e.message, fieldErrors: e.fieldErrors, issues: e.issues };
  }
  if (e instanceof AppError) {
    return { ok: false, message: e.message };
  }
  console.error("[erreur interne]", e);
  return { ok: false, message: "Une erreur inattendue est survenue. Réessayez ou contactez l'administrateur." };
}
