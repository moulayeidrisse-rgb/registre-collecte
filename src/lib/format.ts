import { intlLocale, type Locale } from "@/i18n/config";

const cache = new Map<string, Intl.DateTimeFormat | Intl.NumberFormat>();
function dateFmt(locale: Locale, withTime: boolean) {
  const k = `${locale}-${withTime}`;
  if (!cache.has(k)) {
    cache.set(
      k,
      new Intl.DateTimeFormat(intlLocale(locale), withTime
        ? { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" }
        : { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }),
    );
  }
  return cache.get(k) as Intl.DateTimeFormat;
}
function numFmt(locale: Locale) {
  const k = `n-${locale}`;
  if (!cache.has(k)) cache.set(k, new Intl.NumberFormat(intlLocale(locale), { maximumFractionDigits: 2 }));
  return cache.get(k) as Intl.NumberFormat;
}

export function formatDate(d: Date | string | null | undefined, locale: Locale = "fr"): string {
  if (!d) return "—";
  return dateFmt(locale, false).format(typeof d === "string" ? new Date(d) : d);
}

export function formatDateTime(d: Date | string | null | undefined, locale: Locale = "fr"): string {
  if (!d) return "—";
  return dateFmt(locale, true).format(typeof d === "string" ? new Date(d) : d);
}

export function formatNumber(n: number | null | undefined, locale: Locale = "fr"): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return numFmt(locale).format(n);
}

export function formatPercent(n: number | null | undefined, locale: Locale = "fr"): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return `${numFmt(locale).format(n)} %`;
}
