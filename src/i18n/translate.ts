/**
 * Traduction.
 * Les chaînes de l'interface sont écrites en français dans le code et servent de clés :
 * t("Tableau de bord") renvoie la chaîne telle quelle en français, ou sa traduction arabe.
 * Les messages dynamiques (validation, erreurs serveur, anomalies enregistrées en base)
 * sont traduits par motifs (voir messages-ar.ts).
 */
import type { Locale } from "./config";
import { AR } from "./ar";
import { translateDynamicAr } from "./messages-ar";

export type Params = Record<string, string | number | null | undefined>;
export type TFunction = (key: string, params?: Params) => string;

function interpolate(s: string, params?: Params) {
  if (!params) return s;
  return s.replace(/\{(\w+)\}/g, (m, k) => (params[k] === undefined || params[k] === null ? m : String(params[k])));
}

export function translate(locale: Locale, key: string, params?: Params): string {
  if (locale === "fr") return interpolate(key, params);
  const ar = AR[key];
  return interpolate(ar ?? key, params);
}

/** Traduit un message produit dynamiquement en français (ou le renvoie tel quel s'il est inconnu) */
export function translateMessage(locale: Locale, message: string): string {
  if (locale === "fr" || !message) return message;
  if (AR[message]) return AR[message];
  return translateDynamicAr(message) ?? message;
}

export function makeT(locale: Locale): TFunction {
  return (key, params) => translate(locale, key, params);
}
