import { describe, expect, it } from "vitest";
import { validateSubmission, validateField, isValidIsoDate, parseNumber, duplicateSignature, computeCompleteness } from "@/lib/validation/engine";
import type { FieldDef, RuleDef } from "@/lib/validation/types";

const TODAY = "2026-06-15";
const f = (p: Partial<FieldDef> & Pick<FieldDef, "key" | "type">): FieldDef => ({ label: p.key, required: false, order: 0, ...p });

describe("validateField — types de champs", () => {
  it("champ obligatoire vide → MANQUANT bloquant", () => {
    const r = validateField(f({ key: "nom", type: "TEXTE", required: true, label: "Nom" }), "  ", TODAY);
    expect(r.value).toBeNull();
    expect(r.issues).toEqual([expect.objectContaining({ type: "MANQUANT", severity: "ERREUR", message: "Le champ « Nom » est obligatoire." })]);
  });

  it("champ facultatif vide → aucune anomalie", () => {
    expect(validateField(f({ key: "x", type: "NOMBRE" }), "", TODAY).issues).toEqual([]);
  });

  it("texte : longueurs et formats prédéfinis", () => {
    const field = f({ key: "mail", type: "TEXTE", validation: { format: "email", maxLength: 20 } });
    expect(validateField(field, "agent@exemple.org", TODAY).issues).toEqual([]);
    expect(validateField(field, "pas-un-mail", TODAY).issues[0].type).toBe("FORMAT");
    expect(validateField(field, "tres.long.nom@exemple.org", TODAY).issues.map((i) => i.type)).toContain("HORS_PLAGE");
  });

  it("texte : motif personnalisé avec message explicite", () => {
    const field = f({ key: "code", type: "TEXTE", label: "Code ménage", validation: { pattern: "MEN-[0-9]{4}", patternMessage: "format attendu MEN-0000" } });
    expect(validateField(field, "MEN-0042", TODAY).issues).toEqual([]);
    expect(validateField(field, "MEN-42", TODAY).issues[0].message).toBe("« Code ménage » : format attendu MEN-0000");
  });

  it("nombre : virgule décimale, bornes, entier, vraisemblance", () => {
    const field = f({ key: "age", type: "NOMBRE", label: "Âge", validation: { min: 0, max: 120, integer: true, warnMax: 100 } });
    expect(validateField(field, "42", TODAY)).toEqual({ value: 42, issues: [] });
    expect(validateField(field, "abc", TODAY).issues[0]).toMatchObject({ type: "FORMAT", severity: "ERREUR" });
    expect(validateField(field, "130", TODAY).issues[0]).toMatchObject({ type: "HORS_PLAGE", severity: "ERREUR" });
    expect(validateField(field, "-1", TODAY).issues[0].type).toBe("HORS_PLAGE");
    expect(validateField(field, "12,5", TODAY).issues[0].message).toContain("entier");
    expect(validateField(field, "105", TODAY).issues[0]).toMatchObject({ type: "HORS_PLAGE", severity: "AVERTISSEMENT" });
  });

  it("date : date réelle, bornes, pas dans le futur", () => {
    const field = f({ key: "d", type: "DATE", label: "Date", validation: { minDate: "2020-01-01", notInFuture: true } });
    expect(validateField(field, "2026-02-30", TODAY).issues[0].type).toBe("FORMAT");
    expect(validateField(field, "2019-12-31", TODAY).issues[0].type).toBe("HORS_PLAGE");
    expect(validateField(field, "2026-06-16", TODAY).issues[0].message).toContain("date future");
    expect(validateField(field, "2026-06-15", TODAY).issues).toEqual([]);
  });

  it("liste / choix unique : valeur hors options refusée", () => {
    const field = f({ key: "r", type: "LISTE", options: [{ value: "a", label: "A" }, { value: "b", label: "B" }] });
    expect(validateField(field, "a", TODAY)).toEqual({ value: "a", issues: [] });
    expect(validateField(field, "z", TODAY).issues[0].type).toBe("FORMAT");
    expect(validateField({ ...field, type: "CHOIX_UNIQUE" }, ["a", "b"], TODAY).issues[0].type).toBe("FORMAT");
  });

  it("choix multiple : dédoublonnage, bornes de sélection", () => {
    const field = f({ key: "m", type: "CHOIX_MULTIPLE", options: [{ value: "a", label: "A" }, { value: "b", label: "B" }, { value: "c", label: "C" }], validation: { maxSelected: 2 } });
    expect(validateField(field, ["a", "a", "b"], TODAY).value).toEqual(["a", "b"]);
    expect(validateField(field, ["a", "b", "c"], TODAY).issues[0].type).toBe("HORS_PLAGE");
    expect(validateField(field, ["a", "x"], TODAY).issues[0].type).toBe("FORMAT");
  });

  it("oui/non : interprétation stricte", () => {
    const field = f({ key: "o", type: "OUI_NON" });
    expect(validateField(field, "oui", TODAY).value).toBe(true);
    expect(validateField(field, "non", TODAY).value).toBe(false);
    expect(validateField(field, false, TODAY).value).toBe(false);
    expect(validateField(field, "peut-être", TODAY).issues[0].type).toBe("FORMAT");
  });
});

describe("validateSubmission — règles inter-champs et synthèse", () => {
  const fields: FieldDef[] = [
    f({ key: "date_debut", type: "DATE", order: 0, label: "Date de début" }),
    f({ key: "date_fin", type: "DATE", order: 1, label: "Date de fin" }),
    f({ key: "a_emploi", type: "OUI_NON", order: 2, required: true, label: "A un emploi" }),
    f({ key: "employeur", type: "TEXTE", order: 3, label: "Employeur" }),
    f({ key: "nb_personnes", type: "NOMBRE", order: 4 }),
    f({ key: "nb_enfants", type: "NOMBRE", order: 5 }),
  ];
  const rules: RuleDef[] = [
    { definition: { kind: "COMPARAISON", left: "date_fin", op: ">=", right: "date_debut" }, message: "La date de fin doit suivre la date de début.", severity: "ERREUR" },
    { definition: { kind: "OBLIGATOIRE_SI", target: "employeur", when: { field: "a_emploi", equals: "oui" } }, message: "Indiquez l'employeur.", severity: "ERREUR" },
    { definition: { kind: "COMPARAISON", left: "nb_enfants", op: "<", right: "nb_personnes" }, message: "Plus d'enfants que de personnes ?", severity: "AVERTISSEMENT" },
  ];

  it("réponse cohérente : aucune anomalie, complétude 100 %", () => {
    const r = validateSubmission(fields, rules, { date_debut: "2026-01-01", date_fin: "2026-02-01", a_emploi: "oui", employeur: "Société fictive", nb_personnes: "4", nb_enfants: "2" }, { today: TODAY });
    expect(r.issues).toEqual([]);
    expect(r.completeness).toBe(100);
    expect(r.hasBlockingErrors).toBe(false);
  });

  it("détecte comparaison de dates, obligation conditionnelle et avertissement", () => {
    const r = validateSubmission(fields, rules, { date_debut: "2026-03-01", date_fin: "2026-02-01", a_emploi: true, nb_personnes: "2", nb_enfants: "3" }, { today: TODAY });
    expect(r.issues.map((i) => [i.type, i.severity, i.fieldKey])).toEqual([
      ["INCOHERENCE", "ERREUR", "date_fin"],
      ["MANQUANT", "ERREUR", "employeur"],
      ["INCOHERENCE", "AVERTISSEMENT", "nb_enfants"],
    ]);
    expect(r.hasBlockingErrors).toBe(true);
    expect(r.hasFormatErrors).toBe(false);
  });

  it("une valeur non interprétable marque hasFormatErrors", () => {
    const r = validateSubmission(fields, [], { nb_personnes: "quatre", a_emploi: "non" }, { today: TODAY });
    expect(r.hasFormatErrors).toBe(true);
  });

  it("ignore les clés inconnues envoyées par le client", () => {
    const r = validateSubmission(fields, [], { champ_pirate: "x", a_emploi: "non" }, { today: TODAY });
    expect(Object.keys(r.values)).not.toContain("champ_pirate");
  });

  it("calcule la complétude sur l'ensemble des questions", () => {
    expect(computeCompleteness(fields, { a_emploi: false, nb_personnes: 3, date_debut: null })).toBe(33);
  });
});

describe("utilitaires", () => {
  it("isValidIsoDate", () => {
    expect(isValidIsoDate("2024-02-29")).toBe(true);
    expect(isValidIsoDate("2023-02-29")).toBe(false);
    expect(isValidIsoDate("15/06/2026")).toBe(false);
  });
  it("parseNumber", () => {
    expect(parseNumber("1 234,5")).toBe(1234.5);
    expect(parseNumber("1e3")).toBeNull();
    expect(parseNumber("")).toBeNull();
  });
  it("duplicateSignature : insensible à la casse, aux accents et aux espaces", () => {
    const a = duplicateSignature(["nom", "date"], { nom: "  Élodie   MARTIN ", date: "2026-01-01" });
    const b = duplicateSignature(["nom", "date"], { nom: "elodie martin", date: "2026-01-01" });
    expect(a).toBe(b);
    expect(duplicateSignature(["nom", "date"], { nom: "x", date: null })).toBeNull();
    expect(duplicateSignature([], { nom: "x" })).toBeNull();
  });
});
