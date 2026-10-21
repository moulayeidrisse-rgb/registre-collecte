import { describe, expect, it } from "vitest";
import { formDraftSchema } from "@/lib/validation/form-schema";

const base = { title: "Enquête test", description: null, rules: [], duplicateFieldKeys: [] };

describe("formDraftSchema — définition de formulaire", () => {
  it("accepte une définition valide", () => {
    const r = formDraftSchema.safeParse({
      ...base,
      fields: [
        { key: "age", label: "Âge", type: "NOMBRE", required: true, order: 0, validation: { min: 0, max: 120 } },
        { key: "sexe", label: "Sexe", type: "CHOIX_UNIQUE", required: true, order: 1, options: [{ value: "f", label: "Féminin" }, { value: "m", label: "Masculin" }] },
      ],
      duplicateFieldKeys: ["age"],
    });
    expect(r.success).toBe(true);
  });

  it("refuse identifiants dupliqués, options manquantes, bornes inversées, regex invalide", () => {
    const r = formDraftSchema.safeParse({
      ...base,
      fields: [
        { key: "a", label: "A", type: "NOMBRE", required: false, order: 0, validation: { min: 10, max: 1 } },
        { key: "a", label: "B", type: "LISTE", required: false, order: 1, options: [{ value: "x", label: "X" }] },
        { key: "c", label: "C", type: "TEXTE", required: false, order: 2, validation: { pattern: "([" } },
        { key: "Mauvais Id", label: "D", type: "TEXTE", required: false, order: 3 },
      ],
    });
    expect(r.success).toBe(false);
    const msgs = r.error!.issues.map((i) => i.message).join(" | ");
    expect(msgs).toContain("utilisé plusieurs fois");
    expect(msgs).toContain("au moins 2 options");
    expect(msgs).toContain("minimum est supérieur au maximum");
    expect(msgs).toContain("expression régulière invalide");
    expect(msgs).toContain("Identifiant invalide");
  });

  it("refuse une règle de comparaison entre types incompatibles ou champs inconnus", () => {
    const r = formDraftSchema.safeParse({
      ...base,
      fields: [
        { key: "n", label: "N", type: "NOMBRE", required: false, order: 0 },
        { key: "d", label: "D", type: "DATE", required: false, order: 1 },
      ],
      rules: [
        { definition: { kind: "COMPARAISON", left: "n", op: "<", right: "d" }, message: "x", severity: "ERREUR" },
        { definition: { kind: "OBLIGATOIRE_SI", target: "inconnu", when: { field: "n", equals: "1" } }, message: "y", severity: "ERREUR" },
      ],
      duplicateFieldKeys: ["fantome"],
    });
    expect(r.success).toBe(false);
    const msgs = r.error!.issues.map((i) => i.message).join(" | ");
    expect(msgs).toContain("seuls deux champs Nombre ou deux champs Date");
    expect(msgs).toContain("champ inconnu");
    expect(msgs).toContain("Critère de doublon");
  });
});
