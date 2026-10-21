import type { FieldType, IssueSeverity, IssueType, RuleSeverity } from "@/generated/prisma/enums";

export type { FieldType, IssueSeverity, IssueType, RuleSeverity };

export type FieldOption = { value: string; label: string };

/** Formats prédéfinis pour les champs texte */
export const TEXT_FORMATS = ["email", "telephone", "alphanumerique", "code"] as const;
export type TextFormat = (typeof TEXT_FORMATS)[number];

/** Règles de validation propres à un champ. Toutes facultatives. */
export type FieldValidation = {
  // TEXTE
  minLength?: number;
  maxLength?: number;
  format?: TextFormat;
  pattern?: string;
  patternMessage?: string;
  // NOMBRE
  min?: number;
  max?: number;
  integer?: boolean;
  /** Plage de vraisemblance : en dehors, un avertissement (non bloquant) est émis */
  warnMin?: number;
  warnMax?: number;
  // DATE (format AAAA-MM-JJ)
  minDate?: string;
  maxDate?: string;
  notInFuture?: boolean;
  // CHOIX_MULTIPLE
  minSelected?: number;
  maxSelected?: number;
};

export type FieldDef = {
  id?: string;
  key: string;
  label: string;
  helpText?: string | null;
  type: FieldType;
  required: boolean;
  order: number;
  options?: FieldOption[] | null;
  validation?: FieldValidation | null;
};

export const COMPARISON_OPERATORS = ["<", "<=", ">", ">=", "=", "!="] as const;
export type ComparisonOperator = (typeof COMPARISON_OPERATORS)[number];

/** Règles de cohérence entre champs */
export type RuleDefinition =
  | { kind: "COMPARAISON"; left: string; op: ComparisonOperator; right: string }
  | { kind: "OBLIGATOIRE_SI"; target: string; when: { field: string; equals: string } };

export type RuleDef = {
  id?: string;
  definition: RuleDefinition;
  message: string;
  severity: RuleSeverity;
};

/** Valeur brute reçue d'un formulaire (navigateur ou FormData) */
export type RawValue = string | string[] | boolean | number | null | undefined;
export type RawValues = Record<string, RawValue>;

/** Valeur normalisée et typée */
export type TypedValue = string | number | boolean | string[] | null;
export type TypedValues = Record<string, TypedValue>;

export type ValidationIssue = {
  fieldKey: string | null;
  type: IssueType;
  severity: IssueSeverity;
  message: string;
};

export type ValidationResult = {
  values: TypedValues;
  issues: ValidationIssue[];
  /** Pourcentage de champs renseignés (0–100) */
  completeness: number;
  /** Vrai si au moins une erreur bloquante */
  hasBlockingErrors: boolean;
  /** Vrai si une valeur n'a pas pu être interprétée (empêche même l'enregistrement en brouillon) */
  hasFormatErrors: boolean;
};
