export const LOCALES = ["fr", "ar"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "fr";
/** Cookie lisible par le script d'initialisation (sens d'écriture avant affichage) : non httpOnly, sans donnée sensible */
export const LOCALE_COOKIE = "lang";

export function isLocale(v: unknown): v is Locale {
  return typeof v === "string" && (LOCALES as readonly string[]).includes(v);
}

export function dirOf(locale: Locale): "ltr" | "rtl" {
  return locale === "ar" ? "rtl" : "ltr";
}

/** Locale Intl : chiffres latins en arabe (usage courant en Mauritanie) */
export function intlLocale(locale: Locale): string {
  return locale === "ar" ? "ar-MR-u-nu-latn" : "fr-FR";
}
