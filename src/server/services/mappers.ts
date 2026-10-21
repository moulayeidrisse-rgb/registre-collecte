import "server-only";
import type { FormField, FormRule, SubmissionValue } from "@/generated/prisma/client";
import type { FieldDef, FieldOption, FieldValidation, RuleDef, RuleDefinition, TypedValue, TypedValues } from "@/lib/validation/types";
import { ruleDefinitionSchema } from "@/lib/validation/form-schema";

export function toFieldDef(f: FormField): FieldDef {
  return {
    id: f.id,
    key: f.key,
    label: f.label,
    helpText: f.helpText,
    type: f.type,
    required: f.required,
    order: f.order,
    options: (f.options as FieldOption[] | null) ?? null,
    validation: (f.validation as FieldValidation | null) ?? null,
  };
}

export function toRuleDef(r: FormRule): RuleDef | null {
  const parsed = ruleDefinitionSchema.safeParse(r.definition);
  if (!parsed.success) return null;
  return { id: r.id, definition: parsed.data as RuleDefinition, message: r.message, severity: r.severity };
}

export function toRuleDefs(rules: FormRule[]): RuleDef[] {
  return rules.map(toRuleDef).filter((r): r is RuleDef => r !== null);
}

/** Valeur typée → colonnes de SubmissionValue */
export function toValueColumns(field: Pick<FieldDef, "type">, v: TypedValue) {
  const base = { valueText: null as string | null, valueNumber: null as number | null, valueDate: null as Date | null, valueBool: null as boolean | null, valueJson: undefined as string[] | undefined };
  if (v === null) return base;
  switch (field.type) {
    case "TEXTE":
    case "LISTE":
    case "CHOIX_UNIQUE":
      return { ...base, valueText: String(v) };
    case "NOMBRE":
      return { ...base, valueNumber: Number(v) };
    case "DATE":
      return { ...base, valueDate: new Date(`${v}T00:00:00.000Z`) };
    case "OUI_NON":
      return { ...base, valueBool: Boolean(v) };
    case "CHOIX_MULTIPLE":
      return { ...base, valueJson: Array.isArray(v) ? v : [String(v)] };
  }
}

/** Colonnes de SubmissionValue → valeur typée */
export function fromValueColumns(type: FieldDef["type"], v: Pick<SubmissionValue, "valueText" | "valueNumber" | "valueDate" | "valueBool" | "valueJson">): TypedValue {
  switch (type) {
    case "TEXTE":
    case "LISTE":
    case "CHOIX_UNIQUE":
      return v.valueText;
    case "NOMBRE":
      return v.valueNumber === null ? null : Number(v.valueNumber);
    case "DATE":
      return v.valueDate ? v.valueDate.toISOString().slice(0, 10) : null;
    case "OUI_NON":
      return v.valueBool;
    case "CHOIX_MULTIPLE":
      return Array.isArray(v.valueJson) ? (v.valueJson as string[]) : null;
  }
}

export function valuesByKey(fields: FormField[], values: (SubmissionValue)[]): TypedValues {
  const byId = new Map(fields.map((f) => [f.id, f]));
  const out: TypedValues = {};
  for (const val of values) {
    const f = byId.get(val.fieldId);
    if (f) out[f.key] = fromValueColumns(f.type, val);
  }
  return out;
}

/** Valeur lisible pour l'affichage et l'export */
export function displayValue(field: Pick<FieldDef, "type" | "options">, v: TypedValue): string {
  if (v === null || v === undefined) return "";
  const label = (x: string) => field.options?.find((o) => o.value === x)?.label ?? x;
  switch (field.type) {
    case "OUI_NON":
      return v ? "Oui" : "Non";
    case "LISTE":
    case "CHOIX_UNIQUE":
      return label(String(v));
    case "CHOIX_MULTIPLE":
      return (Array.isArray(v) ? v : [String(v)]).map(label).join(", ");
    case "DATE": {
      const [y, m, d] = String(v).split("-");
      return `${d}/${m}/${y}`;
    }
    case "NOMBRE":
      return String(v).replace(".", ",");
    default:
      return String(v);
  }
}
