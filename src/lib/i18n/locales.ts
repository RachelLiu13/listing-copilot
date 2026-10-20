/** Interface languages. Add one here and a dictionary in ./dict; the type checker lists every missing string. */
export const LOCALES = ["en", "zh", "vi", "es", "ja"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "lang";

/** Shown in the language menu, each in its own language. */
export const LOCALE_LABELS: Record<Locale, string> = { en: "English", zh: "简体中文", vi: "Tiếng Việt", es: "Español", ja: "日本語" };

/** The language name the AI writes explanations in. English readers get no extra explanation step. */
export const LANGUAGE_NAMES: Record<Locale, string> = { en: "English", zh: "Simplified Chinese", vi: "Vietnamese", es: "Spanish", ja: "Japanese" };

export const isLocale = (v: unknown): v is Locale => typeof v === "string" && (LOCALES as readonly string[]).includes(v);

/** Best match for an Accept-Language header, e.g. "zh-CN,zh;q=0.9,en;q=0.8" -> "zh". */
export function pickLocale(acceptLanguage: string | null | undefined): Locale {
  const prefs = (acceptLanguage ?? "")
    .split(",")
    .map((part) => {
      const [tag, q] = part.trim().split(";q=");
      return { lang: tag.toLowerCase().split("-")[0], q: q ? Number(q) : 1 };
    })
    .filter((p) => p.lang)
    .sort((a, b) => b.q - a.q);
  for (const p of prefs) if (isLocale(p.lang)) return p.lang;
  return DEFAULT_LOCALE;
}

/** The explanation language for the AI: the reader's interface language, unless it is English. */
export const explainLanguageFor = (locale: Locale): string | undefined => (locale === "en" ? undefined : LANGUAGE_NAMES[locale]);
