/**
 * Schémas Zod de la définition d'un formulaire (constructeur).
 * Utilisés côté serveur pour refuser toute définition incohérente.
 */
import { z } from "zod";
import { COMPARISON_OPERATORS, TEXT_FORMATS } from "./types";
import { isValidIsoDate } from "./engine";

export const FIELD_KEY_RE = /^[a-z][a-z0-9_]{0,62}$/;

const isoDate = z
  .string()
  .refine((s) => isValidIsoDate(s), { message: "Date invalide (AAAA-MM-JJ attendu)" });

const optNum = z.number().finite().optional();

export const fieldValidationSchema = z
  .object({
    minLength: z.number().int().min(0).max(5000).optional(),
    maxLength: z.number().int().min(1).max(5000).optional(),
    format: z.enum(TEXT_FORMATS).optional(),
    pattern: z.string().max(200).optional(),
    patternMessage: z.string().max(200).optional(),
    min: optNum,
    max: optNum,
    integer: z.boolean().optional(),
    warnMin: optNum,
    warnMax: optNum,
    minDate: isoDate.optional(),
    maxDate: isoDate.optional(),
    notInFuture: z.boolean().optional(),
    minSelected: z.number().int().min(0).max(100).optional(),
    maxSelected: z.number().int().min(1).max(100).optional(),
  })
  .strict();

export const fieldOptionSchema = z.object({
  value: z.string().trim().min(1, "Valeur d'option vide").max(100),
  label: z.string().trim().min(1, "Libellé d'option vide").max(200),
});

export const fieldTypeSchema = z.enum([
  "TEXTE",
  "NOMBRE",
  "DATE",
  "LISTE",
  "CHOIX_UNIQUE",
  "CHOIX_MULTIPLE",
  "OUI_NON",
]);

export const fieldDefSchema = z.object({
  key: z
    .string()
    .trim()
    .regex(FIELD_KEY_RE, "Identifiant invalide : minuscules, chiffres et _ uniquement, commençant par une lettre"),
  label: z.string().trim().min(1, "Le libellé est obligatoire").max(300),
  helpText: z.string().trim().max(500).nullish(),
  type: fieldTypeSchema,
  required: z.boolean(),
  order: z.number().int().min(0),
  options: z.array(fieldOptionSchema).max(200).nullish(),
  validation: fieldValidationSchema.nullish(),
});

export const ruleDefinitionSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("COMPARAISON"),
    left: z.string(),
    op: z.enum(COMPARISON_OPERATORS),
    right: z.string(),
  }),
  z.object({
    kind: z.literal("OBLIGATOIRE_SI"),
    target: z.string(),
    when: z.object({ field: z.string(), equals: z.string().trim().min(1, "Valeur de condition vide") }),
  }),
]);

export const ruleDefSchema = z.object({
  definition: ruleDefinitionSchema,
  message: z.string().trim().min(1, "Le message de la règle est obligatoire").max(300),
  severity: z.enum(["ERREUR", "AVERTISSEMENT"]),
});

export const formMetaSchema = z.object({
  title: z.string().trim().min(3, "Le titre doit contenir au moins 3 caractères").max(200),
  description: z.string().trim().max(2000).nullish(),
});

export const formCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9][A-Z0-9-]{1,29}$/, "Code invalide : 2 à 30 caractères, lettres majuscules, chiffres et tirets");

export const formDraftSchema = formMetaSchema
  .extend({
    fields: z.array(fieldDefSchema).max(150, "150 questions au maximum"),
    rules: z.array(ruleDefSchema).max(100),
    duplicateFieldKeys: z.array(z.string()).max(10),
  })
  .superRefine((data, ctx) => {
    const keys = new Map<string, (typeof data.fields)[number]>();
    data.fields.forEach((f, i) => {
      const path = ["fields", i];
      if (keys.has(f.key)) ctx.addIssue({ code: "custom", path: [...path, "key"], message: `Identifiant « ${f.key} » utilisé plusieurs fois` });
      keys.set(f.key, f);

      const needsOptions = f.type === "LISTE" || f.type === "CHOIX_UNIQUE" || f.type === "CHOIX_MULTIPLE";
      const opts = f.options ?? [];
      if (needsOptions) {
        if (opts.length < 2) ctx.addIssue({ code: "custom", path: [...path, "options"], message: `« ${f.label} » : au moins 2 options sont nécessaires` });
        const vals = opts.map((o) => o.value);
        if (new Set(vals).size !== vals.length) ctx.addIssue({ code: "custom", path: [...path, "options"], message: `« ${f.label} » : valeurs d'options en double` });
      }
      const v = f.validation ?? {};
      if (v.min !== undefined && v.max !== undefined && v.min > v.max)
        ctx.addIssue({ code: "custom", path: [...path, "validation"], message: `« ${f.label} » : le minimum est supérieur au maximum` });
      if (v.warnMin !== undefined && v.warnMax !== undefined && v.warnMin > v.warnMax)
        ctx.addIssue({ code: "custom", path: [...path, "validation"], message: `« ${f.label} » : plage de vraisemblance incohérente` });
      if (v.minLength !== undefined && v.maxLength !== undefined && v.minLength > v.maxLength)
        ctx.addIssue({ code: "custom", path: [...path, "validation"], message: `« ${f.label} » : longueur minimale supérieure à la longueur maximale` });
      if (v.minDate && v.maxDate && v.minDate > v.maxDate)
        ctx.addIssue({ code: "custom", path: [...path, "validation"], message: `« ${f.label} » : date minimale postérieure à la date maximale` });
      if (v.minSelected !== undefined && v.maxSelected !== undefined && v.minSelected > v.maxSelected)
        ctx.addIssue({ code: "custom", path: [...path, "validation"], message: `« ${f.label} » : nombre de choix minimal supérieur au maximal` });
      if (v.pattern) {
        try {
          new RegExp(v.pattern, "u");
        } catch {
          ctx.addIssue({ code: "custom", path: [...path, "validation"], message: `« ${f.label} » : expression régulière invalide` });
        }
      }
    });

    data.rules.forEach((r, i) => {
      const path = ["rules", i];
      const d = r.definition;
      if (d.kind === "COMPARAISON") {
        const a = keys.get(d.left);
        const b = keys.get(d.right);
        if (!a || !b) {
          ctx.addIssue({ code: "custom", path, message: `Règle ${i + 1} : champ inconnu` });
          return;
        }
        const comparable = (t: string) => t === "NOMBRE" || t === "DATE";
        if (!comparable(a.type) || a.type !== b.type)
          ctx.addIssue({ code: "custom", path, message: `Règle ${i + 1} : seuls deux champs Nombre ou deux champs Date peuvent être comparés` });
        if (d.left === d.right) ctx.addIssue({ code: "custom", path, message: `Règle ${i + 1} : un champ ne peut pas être comparé à lui-même` });
      } else {
        if (!keys.has(d.target) || !keys.has(d.when.field)) ctx.addIssue({ code: "custom", path, message: `Règle ${i + 1} : champ inconnu` });
        if (d.target === d.when.field) ctx.addIssue({ code: "custom", path, message: `Règle ${i + 1} : la condition doit porter sur un autre champ` });
      }
    });

    data.duplicateFieldKeys.forEach((k, i) => {
      if (!keys.has(k)) ctx.addIssue({ code: "custom", path: ["duplicateFieldKeys", i], message: `Critère de doublon : champ « ${k} » inconnu` });
    });
  });

export type FormDraftInput = z.infer<typeof formDraftSchema>;
