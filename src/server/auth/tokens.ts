import "server-only";
import { createHash, randomBytes } from "node:crypto";

/** Jeton de session aléatoire (256 bits), encodé en base64url */
export function generateSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}
