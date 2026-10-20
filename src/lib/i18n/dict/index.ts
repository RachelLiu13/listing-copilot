import type { Locale } from "../locales";
import { en, type Dict } from "./en";
import { es } from "./es";
import { ja } from "./ja";
import { vi } from "./vi";
import { zh } from "./zh";

export type { Dict };

export const DICTS: Record<Locale, Dict> = { en, zh, vi, es, ja };
