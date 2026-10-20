"use client";

import { createContext, useContext } from "react";
import { DICTS } from "./dict";
import { DEFAULT_LOCALE, type Locale } from "./locales";

const LocaleContext = createContext<Locale>(DEFAULT_LOCALE);

export function LocaleProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export const useLocale = () => useContext(LocaleContext);
export const useT = () => DICTS[useContext(LocaleContext)];
