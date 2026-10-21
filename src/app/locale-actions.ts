"use server";

import { cookies } from "next/headers";
import { refresh } from "next/cache";
import { isLocale, LOCALE_COOKIE } from "@/i18n/config";

/** Change la langue de l'interface (préférence d'affichage, pas une donnée sensible) */
export async function setLocaleAction(locale: string) {
  if (!isLocale(locale)) return;
  (await cookies()).set(LOCALE_COOKIE, locale, {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
    secure: process.env.NODE_ENV === "production" && process.env.COOKIE_SECURE !== "false",
  });
  refresh();
}
