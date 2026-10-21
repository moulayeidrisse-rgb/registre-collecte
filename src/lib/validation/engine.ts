/**
 * Moteur de validation des réponses.
 * Code pur, sans dépendance serveur : exécuté côté serveur (référence) et dans le navigateur
 * (retour immédiat). Le serveur fait toujours foi.
 */
import type {
  ComparisonOperator,
  FieldDef,
  RawValue,
  RawValues,
  RuleDef,
  TypedValue,
  TypedValues,
  ValidationIssue,
  ValidationResult,
} from "./types";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^\+?[0-9 ().-]{6,20}$/;
const ALNUM_RE = /^[\p{L}\p{N} ]+$/u;
const CODE_RE = /^[A-Za-z0-9_-]+$/;
const MAX_TEXT_LENGTH = 5000;

export const FORMAT_MESSAGES: Record<string, string> = {
  email: "doit être une adresse électronique valide (ex. nom@exemple.org)",
  telephone: "doit être un numéro de téléphone valide (chiffres, espaces, +, -, parenthèses)",
  alphanumerique: "ne doit contenir que des lettres, des chiffres et des espaces",
  code: "ne doit contenir que des lettres, chiffres, tirets ou soulignés, sans espace",
};

export function isEmpty(v: RawValue | TypedValue): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v === "string") return v.trim() === "";
  if (Array.isArray(v)) return v.length === 0;
  return false;
}

/** Vérifie qu'une chaîne AAAA-MM-JJ correspond à une date calendaire réelle */
export function isValidIsoDate(s: string): boolean {
  if (!DATE_RE.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function todayIso(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** Convertit « 12,5 » ou « 12.5 » en nombre ; renvoie null si invalide */
export function parseNumber(v: RawValue): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string") return null;
  const s = v.trim().replace(/\s/g, "").replace(",", ".");
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function parseBool(v: RawValue): boolean | null | "invalid" {
  if (typeof v === "boolean") return v;
  if (typeof v !== "string") return "invalid";
  const s = v.trim().toLowerCase();
  if (["oui", "true", "1"].includes(s)) return true;
  if (["non", "false", "0"].includes(s)) return false;
  return "invalid";
}

function q(label: string) {
  return `« ${label} »`;
}

type FieldCheck = { value: TypedValue; issues: ValidationIssue[] };

function err(field: FieldDef, type: ValidationIssue["type"], message: string): ValidationIssue {
  return { fieldKey: field.key, type, severity: "ERREUR", message };
}
function warn(field: FieldDef, type: ValidationIssue["type"], message: string): ValidationIssue {
  return { fieldKey: field.key, type, severity: "AVERTISSEMENT", message };
}

/** Valide un champ isolé : interprétation du type, obligation, plages et formats */
export function validateField(field: FieldDef, raw: RawValue, today: string): FieldCheck {
  const v = field.validation ?? {};
  const label = q(field.label);

  if (isEmpty(raw)) {
    return {
      value: null,
      issues: field.required ? [err(field, "MANQUANT", `Le champ ${label} est obligatoire.`)] : [],
    };
  }

  switch (field.type) {
    case "TEXTE": {
      if (typeof raw !== "string") return { value: null, issues: [err(field, "FORMAT", `Le champ ${label} doit être un texte.`)] };
      const s = raw.trim();
      const issues: ValidationIssue[] = [];
      if (s.length > MAX_TEXT_LENGTH) issues.push(err(field, "FORMAT", `Le champ ${label} dépasse ${MAX_TEXT_LENGTH} caractères.`));
      if (v.minLength !== undefined && s.length < v.minLength)
        issues.push(err(field, "HORS_PLAGE", `Le champ ${label} doit contenir au moins ${v.minLength} caractères (actuellement ${s.length}).`));
      if (v.maxLength !== undefined && s.length > v.maxLength)
        issues.push(err(field, "HORS_PLAGE", `Le champ ${label} doit contenir au plus ${v.maxLength} caractères (actuellement ${s.length}).`));
      if (v.format) {
        const re = { email: EMAIL_RE, telephone: PHONE_RE, alphanumerique: ALNUM_RE, code: CODE_RE }[v.format];
        if (re && !re.test(s)) issues.push(err(field, "FORMAT", `Le champ ${label} ${FORMAT_MESSAGES[v.format]}.`));
      }
      if (v.pattern) {
        let re: RegExp | null = null;
        try {
          re = new RegExp(`^(?:${v.pattern})$`, "u");
        } catch {
          re = null; // motif invalide : ignoré (refusé à l'enregistrement du formulaire)
        }
        if (re && !re.test(s))
          issues.push(err(field, "FORMAT", v.patternMessage ? `${label} : ${v.patternMessage}` : `Le champ ${label} n'a pas le format attendu.`));
      }
      // Une valeur texte reste enregistrable même si son format est incorrect : seules les
      // erreurs d'interprétation de type bloquent l'enregistrement en brouillon.
      return { value: s, issues };
    }

    case "NOMBRE": {
      const n = parseNumber(raw);
      if (n === null) return { value: null, issues: [err(field, "FORMAT", `Le champ ${label} doit être un nombre (ex. 12 ou 12,5).`)] };
      const issues: ValidationIssue[] = [];
      if (v.integer && !Number.isInteger(n)) issues.push(err(field, "FORMAT", `Le champ ${label} doit être un nombre entier.`));
      if (v.min !== undefined && n < v.min) issues.push(err(field, "HORS_PLAGE", `Le champ ${label} doit être supérieur ou égal à ${fmt(v.min)} (valeur saisie : ${fmt(n)}).`));
      if (v.max !== undefined && n > v.max) issues.push(err(field, "HORS_PLAGE", `Le champ ${label} doit être inférieur ou égal à ${fmt(v.max)} (valeur saisie : ${fmt(n)}).`));
      if (issues.length === 0) {
        if (v.warnMin !== undefined && n < v.warnMin)
          issues.push(warn(field, "HORS_PLAGE", `Valeur inhabituelle pour ${label} : ${fmt(n)} (en dessous de ${fmt(v.warnMin)}). Vérifiez la saisie.`));
        if (v.warnMax !== undefined && n > v.warnMax)
          issues.push(warn(field, "HORS_PLAGE", `Valeur inhabituelle pour ${label} : ${fmt(n)} (au-dessus de ${fmt(v.warnMax)}). Vérifiez la saisie.`));
      }
      return { value: n, issues };
    }

    case "DATE": {
      if (typeof raw !== "string" || !isValidIsoDate(raw.trim()))
        return { value: null, issues: [err(field, "FORMAT", `Le champ ${label} doit être une date valide (JJ/MM/AAAA).`)] };
      const s = raw.trim();
      const issues: ValidationIssue[] = [];
      if (v.minDate && s < v.minDate) issues.push(err(field, "HORS_PLAGE", `Le champ ${label} doit être postérieur ou égal au ${frDate(v.minDate)}.`));
      if (v.maxDate && s > v.maxDate) issues.push(err(field, "HORS_PLAGE", `Le champ ${label} doit être antérieur ou égal au ${frDate(v.maxDate)}.`));
      if (v.notInFuture && s > today) issues.push(err(field, "HORS_PLAGE", `Le champ ${label} ne peut pas être une date future.`));
      return { value: s, issues };
    }

    case "LISTE":
    case "CHOIX_UNIQUE": {
      if (typeof raw !== "string") return { value: null, issues: [err(field, "FORMAT", `Le champ ${label} attend une seule valeur.`)] };
      const s = raw.trim();
      const allowed = (field.options ?? []).map((o) => o.value);
      if (!allowed.includes(s)) return { value: null, issues: [err(field, "FORMAT", `La valeur choisie pour ${label} n'est pas autorisée.`)] };
      return { value: s, issues: [] };
    }

    case "CHOIX_MULTIPLE": {
      const arr = Array.isArray(raw) ? raw : typeof raw === "string" ? [raw] : null;
      if (!arr) return { value: null, issues: [err(field, "FORMAT", `Le champ ${label} attend une liste de valeurs.`)] };
      const allowed = new Set((field.options ?? []).map((o) => o.value));
      const vals = [...new Set(arr.map((x) => String(x).trim()).filter(Boolean))];
      if (vals.some((x) => !allowed.has(x))) return { value: null, issues: [err(field, "FORMAT", `Une des valeurs choisies pour ${label} n'est pas autorisée.`)] };
      const issues: ValidationIssue[] = [];
      if (v.minSelected !== undefined && vals.length < v.minSelected)
        issues.push(err(field, "HORS_PLAGE", `Sélectionnez au moins ${v.minSelected} choix pour ${label}.`));
      if (v.maxSelected !== undefined && vals.length > v.maxSelected)
        issues.push(err(field, "HORS_PLAGE", `Sélectionnez au plus ${v.maxSelected} choix pour ${label}.`));
      if (vals.length === 0)
        return { value: null, issues: field.required ? [err(field, "MANQUANT", `Le champ ${label} est obligatoire.`)] : [] };
      return { value: vals, issues };
    }

    case "OUI_NON": {
      const b = parseBool(raw);
      if (b === "invalid") return { value: null, issues: [err(field, "FORMAT", `Le champ ${label} attend « Oui » ou « Non ».`)] };
      return { value: b, issues: [] };
    }
  }
}

function fmt(n: number) {
  return n.toLocaleString("fr-FR", { maximumFractionDigits: 4 });
}

export function frDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function compare(a: number | string, op: ComparisonOperator, b: number | string): boolean {
  switch (op) {
    case "<": return a < b;
    case "<=": return a <= b;
    case ">": return a > b;
    case ">=": return a >= b;
    case "=": return a === b;
    case "!=": return a !== b;
  }
}

function valueEquals(v: TypedValue, expected: string): boolean {
  if (v === null) return false;
  if (typeof v === "boolean") return (v ? "oui" : "non") === expected.toLowerCase() || String(v) === expected;
  if (Array.isArray(v)) return v.includes(expected);
  return String(v) === expected;
}

/** Applique les règles de cohérence entre champs sur des valeurs déjà typées */
export function applyRules(fields: FieldDef[], rules: RuleDef[], values: TypedValues): ValidationIssue[] {
  const byKey = new Map(fields.map((f) => [f.key, f]));
  const issues: ValidationIssue[] = [];
  for (const rule of rules) {
    const d = rule.definition;
    if (d.kind === "COMPARAISON") {
      const a = values[d.left];
      const b = values[d.right];
      if (a === null || b === null || a === undefined || b === undefined) continue;
      if ((typeof a === "number" && typeof b === "number") || (typeof a === "string" && typeof b === "string")) {
        if (!compare(a, d.op, b)) {
          issues.push({ fieldKey: d.left, type: "INCOHERENCE", severity: rule.severity, message: rule.message });
        }
      }
    } else if (d.kind === "OBLIGATOIRE_SI") {
      if (!byKey.has(d.target)) continue;
      if (valueEquals(values[d.when.field] ?? null, d.when.equals) && isEmpty(values[d.target] ?? null)) {
        issues.push({ fieldKey: d.target, type: "MANQUANT", severity: rule.severity, message: rule.message });
      }
    }
  }
  return issues;
}

export function computeCompleteness(fields: FieldDef[], values: TypedValues): number {
  if (fields.length === 0) return 0;
  const filled = fields.filter((f) => !isEmpty(values[f.key] ?? null)).length;
  return Math.round((filled / fields.length) * 100);
}

/**
 * Valide une réponse complète.
 * Les clés inconnues dans `raw` sont ignorées (jamais enregistrées).
 */
export function validateSubmission(
  fields: FieldDef[],
  rules: RuleDef[],
  raw: RawValues,
  opts: { today?: string } = {},
): ValidationResult {
  const today = opts.today ?? todayIso();
  const values: TypedValues = {};
  const issues: ValidationIssue[] = [];
  let hasFormatErrors = false;

  const sorted = [...fields].sort((a, b) => a.order - b.order);
  for (const field of sorted) {
    const r = validateField(field, raw[field.key], today);
    values[field.key] = r.value;
    issues.push(...r.issues);
    // Une valeur saisie mais non interprétable (type incorrect) ne peut pas être stockée
    if (!isEmpty(raw[field.key]) && r.value === null) hasFormatErrors = true;
  }
  issues.push(...applyRules(sorted, rules, values));

  return {
    values,
    issues,
    completeness: computeCompleteness(sorted, values),
    hasBlockingErrors: issues.some((i) => i.severity === "ERREUR"),
    hasFormatErrors,
  };
}

/** Regroupe les messages par champ (pour l'affichage sous chaque champ) */
export function issuesByField(issues: ValidationIssue[]): Record<string, ValidationIssue[]> {
  const out: Record<string, ValidationIssue[]> = {};
  for (const i of issues) {
    const k = i.fieldKey ?? "_form";
    (out[k] ??= []).push(i);
  }
  return out;
}

/** Normalise une valeur pour la détection de doublons (casse, accents, espaces) */
export function normalizeForDuplicate(v: TypedValue): string | null {
  if (v === null || v === undefined) return null;
  if (Array.isArray(v)) return [...v].sort().join(",");
  return String(v)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Construit la chaîne de dédoublonnage ; null si un des champs-clés est vide */
export function duplicateSignature(keys: string[], values: TypedValues): string | null {
  if (keys.length === 0) return null;
  const parts: string[] = [];
  for (const k of keys) {
    const n = normalizeForDuplicate(values[k] ?? null);
    if (n === null || n === "") return null;
    parts.push(`${k}=${n}`);
  }
  return parts.join("|");
}
