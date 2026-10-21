import "server-only";
import { hash, verify } from "@node-rs/argon2";

// Paramètres argon2id (recommandations OWASP : m=19 Mio, t=2, p=1)
const OPTIONS = { memoryCost: 19456, timeCost: 2, parallelism: 1, outputLen: 32 } as const;

export async function hashPassword(password: string): Promise<string> {
  return hash(password, OPTIONS);
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}

/** Hachage factice : permet un temps de réponse constant quand l'utilisateur n'existe pas */
let dummyHash: Promise<string> | null = null;
export function getDummyHash() {
  dummyHash ??= hash("mot-de-passe-factice-non-utilise", OPTIONS);
  return dummyHash;
}

/** Politique de mot de passe : 10 caractères minimum, au moins une lettre et un chiffre */
export function checkPasswordPolicy(password: string): string | null {
  if (password.length < 10) return "Le mot de passe doit contenir au moins 10 caractères.";
  if (password.length > 128) return "Le mot de passe ne doit pas dépasser 128 caractères.";
  if (!/\p{L}/u.test(password) || !/\d/.test(password)) return "Le mot de passe doit contenir au moins une lettre et un chiffre.";
  return null;
}
