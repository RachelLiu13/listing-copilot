import "server-only";
import { cookies, headers } from "next/headers";
import { DICTS } from "./dict";
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, pickLocale, type Locale } from "./locales";

/** The visitor's language: their saved choice, else their browser's preference. */
export async function getLocale(): Promise<Locale> {
  try {
    const saved = (await cookies()).get(LOCALE_COOKIE)?.value;
    if (isLocale(saved)) return saved;
    return pickLocale((await headers()).get("accept-language"));
  } catch {
    return DEFAULT_LOCALE;
  }
}

export async function getT() {
  return DICTS[await getLocale()];
}

/** For API routes: the locale from the request's cookie or Accept-Language header. */
export function localeOf(req: Request): Locale {
  const cookie = req.headers.get("cookie") ?? "";
  const m = cookie.match(new RegExp(`(?:^|;\\s*)${LOCALE_COOKIE}=([a-z]{2})`));
  if (m && isLocale(m[1])) return m[1];
  return pickLocale(req.headers.get("accept-language"));
}
