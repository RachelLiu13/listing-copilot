"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useLocale, useT } from "@/lib/i18n/client";
import { LOCALE_COOKIE, LOCALE_LABELS, LOCALES, isLocale } from "@/lib/i18n/locales";

/** Saves the choice in a cookie (works signed out) and re-renders the page in that language. */
export default function LanguageSwitcher() {
  const locale = useLocale();
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();

  function choose(value: string) {
    if (!isLocale(value)) return;
    document.cookie = `${LOCALE_COOKIE}=${value}; path=/; max-age=31536000; samesite=lax`;
    start(() => router.refresh());
  }

  return (
    <label className="flex items-center gap-1 text-slate-600">
      <span aria-hidden>🌐</span>
      <span className="sr-only">{t.nav.language}</span>
      <select
        value={locale}
        onChange={(e) => choose(e.target.value)}
        disabled={pending}
        className="rounded-md border border-slate-200 bg-white px-1.5 py-1 text-sm hover:border-slate-300 disabled:opacity-60"
      >
        {LOCALES.map((l) => (
          <option key={l} value={l}>{LOCALE_LABELS[l]}</option>
        ))}
      </select>
    </label>
  );
}
