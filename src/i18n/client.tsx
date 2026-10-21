"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { DEFAULT_LOCALE, type Locale } from "./config";
import { makeT, translateMessage, type TFunction } from "./translate";

const Ctx = createContext<Locale>(DEFAULT_LOCALE);

export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  return <Ctx.Provider value={locale}>{children}</Ctx.Provider>;
}

export function useLocale(): Locale {
  return useContext(Ctx);
}

export function useT(): TFunction & { locale: Locale; msg: (m: string) => string } {
  const locale = useLocale();
  return useMemo(() => Object.assign(makeT(locale), { locale, msg: (m: string) => translateMessage(locale, m) }), [locale]);
}
