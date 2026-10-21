import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, type Locale } from "./config";
import { makeT, translateMessage } from "./translate";

/** Langue de l'utilisateur (cookie) — lit la requête : à appeler sous <Suspense> */
export const getLocale = cache(async (): Promise<Locale> => {
  const v = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(v) ? v : DEFAULT_LOCALE;
});

export async function getT() {
  const locale = await getLocale();
  return Object.assign(makeT(locale), { locale, msg: (m: string) => translateMessage(locale, m) });
}
