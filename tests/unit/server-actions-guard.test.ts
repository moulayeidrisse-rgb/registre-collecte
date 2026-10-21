import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

/**
 * Garde-fou statique : toute Server Action exportée doit vérifier la session côté serveur
 * (requireActor / getCurrentUser) ou être l'action de connexion. Empêche l'ajout d'une action
 * qui ne contrôlerait pas les droits.
 */
function findActionFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) return findActionFiles(p);
    return name === "actions.ts" ? [p] : [];
  });
}

const ALLOWED_WITHOUT_SESSION = new Set(["loginAction"]);

describe("Server Actions", () => {
  const files = findActionFiles(path.resolve(import.meta.dirname, "../../src/app"));

  it("des fichiers d'actions sont trouvés", () => {
    expect(files.length).toBeGreaterThanOrEqual(5);
  });

  for (const file of files) {
    const src = readFileSync(file, "utf8");
    it(`${path.relative(process.cwd(), file)} : directive "use server"`, () => {
      expect(src.trimStart().startsWith('"use server"')).toBe(true);
    });
    const fns = [...src.matchAll(/export async function (\w+)\s*\(([\s\S]*?)\n\}/g)];
    for (const [, name, body] of fns) {
      it(`${name} vérifie la session côté serveur`, () => {
        if (ALLOWED_WITHOUT_SESSION.has(name)) return;
        expect(body).toMatch(/requireActor\(|getCurrentUser\(/);
      });
    }
  }
});
