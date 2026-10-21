import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { AR } from "@/i18n/ar";
import { translate, translateMessage } from "@/i18n/translate";
import * as labels from "@/lib/labels";
import { validateSubmission } from "@/lib/validation/engine";
import type { FieldDef } from "@/lib/validation/types";

const SRC = path.resolve(import.meta.dirname, "../../src");
function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = path.join(dir, n);
    if (statSync(p).isDirectory()) return n === "generated" ? [] : files(p);
    return /\.tsx?$/.test(n) ? [p] : [];
  });
}

describe("traduction arabe", () => {
  it("chaque texte t(\"…\") du code a une traduction arabe", () => {
    const missing = new Set<string>();
    for (const f of files(SRC)) {
      for (const m of readFileSync(f, "utf8").matchAll(/\bt\("((?:[^"\\]|\\.)*)"/g)) {
        const k = m[1].replace(/\\"/g, '"');
        if (!(k in AR)) missing.add(`${path.relative(SRC, f)} : ${k}`);
      }
    }
    expect([...missing]).toEqual([]);
  });

  it("tous les libellés (rôles, statuts, types, anomalies, audit) sont traduits", () => {
    const maps = [labels.ROLE_LABELS, labels.FORM_STATUS_LABELS, labels.VERSION_STATUS_LABELS, labels.SUBMISSION_STATUS_LABELS, labels.FIELD_TYPE_LABELS, labels.ISSUE_TYPE_LABELS, labels.SEVERITY_LABELS, labels.AUDIT_ACTION_LABELS];
    const missing = maps.flatMap((m) => Object.values(m)).filter((v) => !(v in AR));
    expect(missing).toEqual([]);
  });

  it("les traductions conservent les variables {…}", () => {
    const bad = Object.entries(AR).filter(([k, v]) => {
      const vars = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((x) => x[1]).sort().join(",");
      return vars(k) !== vars(v);
    });
    expect(bad).toEqual([]);
  });

  it("interpolation et repli", () => {
    expect(translate("ar", "Question {n}", { n: 3 })).toBe("السؤال 3");
    expect(translate("fr", "Question {n}", { n: 3 })).toBe("Question 3");
    expect(translate("ar", "Texte saisi par un utilisateur")).toBe("Texte saisi par un utilisateur");
  });

  it("tous les messages du moteur de validation sont traduits en arabe", () => {
    const f = (p: Partial<FieldDef> & Pick<FieldDef, "key" | "type">): FieldDef => ({ label: "Âge", required: true, order: 0, ...p });
    const fields: FieldDef[] = [
      f({ key: "a", type: "TEXTE", validation: { minLength: 5, format: "email" } }),
      f({ key: "b", type: "NOMBRE", validation: { min: 1, max: 10, integer: true } }),
      f({ key: "c", type: "NOMBRE", validation: { warnMax: 5 } }),
      f({ key: "d", type: "DATE", validation: { notInFuture: true, minDate: "2020-01-01" } }),
      f({ key: "e", type: "LISTE", options: [{ value: "x", label: "X" }, { value: "y", label: "Y" }] }),
      f({ key: "g", type: "CHOIX_MULTIPLE", options: [{ value: "x", label: "X" }, { value: "y", label: "Y" }], validation: { maxSelected: 1 } }),
      f({ key: "h", type: "OUI_NON" }),
      f({ key: "i", type: "TEXTE" }),
      f({ key: "j", type: "NOMBRE" }),
    ];
    const r = validateSubmission(fields, [], { a: "ab", b: "12,5", c: "9", d: "2099-01-01", e: "z", g: ["x", "y"], h: "peut-être", j: "abc" }, { today: "2026-06-15" });
    expect(r.issues.length).toBeGreaterThan(8);
    for (const i of r.issues) {
      const ar = translateMessage("ar", i.message);
      expect(ar, i.message).not.toBe(i.message);
      expect(ar).toMatch(/[؀-ۿ]/);
    }
  });

  it("messages dynamiques des services traduits", () => {
    for (const m of [
      "La réponse ne peut pas être soumise : 3 erreurs à corriger.",
      "Trop de tentatives de connexion. Réessayez dans 15 minutes.",
      "Doublon potentiel : mêmes valeurs que la réponse R-2026-ABCD1234 sur les critères de dédoublonnage.",
      "Réponse R-2026-ABCD1234 soumise avec 2 point(s) à vérifier.",
      "Version 2 publiée : le formulaire est disponible pour la collecte.",
      "« Région » : au moins 2 options sont nécessaires",
    ]) {
      expect(translateMessage("ar", m), m).toMatch(/[؀-ۿ]/);
    }
  });
});
