import { describe, expect, it } from "vitest";
import { DICTS } from "@/lib/i18n/dict";
import { errorText } from "@/lib/i18n/errors";
import { explainLanguageFor, LOCALES, pickLocale } from "@/lib/i18n/locales";

/** Every string path in a dictionary, with functions and arrays reduced to their kind. */
function shape(v: unknown, path = ""): string[] {
  if (typeof v === "function") return [`${path}()`];
  if (Array.isArray(v)) return v.flatMap((x, i) => shape(x, `${path}[${i}]`));
  if (v && typeof v === "object") return Object.entries(v).flatMap(([k, x]) => shape(x, path ? `${path}.${k}` : k));
  return [path];
}

describe("interface languages", () => {
  it("picks the best supported language from the browser header", () => {
    expect(pickLocale("zh-CN,zh;q=0.9,en;q=0.8")).toBe("zh");
    expect(pickLocale("fr-FR,vi;q=0.7,en;q=0.5")).toBe("vi");
    expect(pickLocale("en-US;q=0.4,ja;q=0.9")).toBe("ja");
    expect(pickLocale("de-DE")).toBe("en");
    expect(pickLocale(null)).toBe("en");
  });

  it("has every string in every language, with no empty values", () => {
    const en = shape(DICTS.en);
    for (const l of LOCALES) {
      expect(shape(DICTS[l])).toEqual(en);
      const empty = Object.entries(DICTS[l]).filter(([, v]) => v === "");
      expect(empty).toEqual([]);
    }
  });

  it("asks the AI to explain in the interface language, except English", () => {
    expect(explainLanguageFor("en")).toBeUndefined();
    expect(explainLanguageFor("zh")).toBe("Simplified Chinese");
    expect(explainLanguageFor("vi")).toBe("Vietnamese");
  });

  it("shows API errors in the reader's language, falling back to the server message", () => {
    expect(errorText(DICTS.zh, { code: "rate_limited", message: "slow down" })).toBe(DICTS.zh.apiErrors.rate_limited);
    expect(errorText(DICTS.es, { code: "rewrite_failed", ai: "unavailable" })).toBe(DICTS.es.apiErrors.ai_unavailable);
    expect(errorText(DICTS.ja, { code: "save_failed", message: "Could not save." })).toBe("Could not save.");
    expect(errorText(DICTS.vi, null)).toBe(DICTS.vi.apiErrors.failed);
    expect(errorText(DICTS.ja, { code: "monthly_limit", message: "limit" })).toBe(DICTS.ja.apiErrors.monthly_limit);
  });
});
