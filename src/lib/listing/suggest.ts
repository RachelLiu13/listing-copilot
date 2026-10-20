import { PLATFORMS, type Platform } from "./platforms";

/**
 * Real shopper phrases: what the marketplace's own search box suggests for a
 * seed phrase. Used as a signal for the keyword step, never as a requirement:
 * any failure (blocked, slow, changed format) returns an empty list and the
 * pipeline carries on with model-estimated keywords.
 */
export type Suggest = (seed: string, platform: Platform) => Promise<string[]>;

export const fetchSuggestions: Suggest = async (seed, platform) => {
  const target = PLATFORMS[platform].suggest;
  if (!target || !seed.trim()) return [];
  const url = `https://${target.host}/api/2017/suggestions?limit=10&alias=aps&mid=${target.marketplaceId}&prefix=${encodeURIComponent(seed.trim().toLowerCase())}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(2500), headers: { Accept: "application/json" } });
    if (!res.ok) return [];
    const body = (await res.json()) as { suggestions?: { value?: unknown }[] };
    return (body.suggestions ?? []).map((s) => (typeof s.value === "string" ? s.value : "")).filter(Boolean).slice(0, 10);
  } catch {
    return [];
  }
};

/** A few seeds per product, de-duplicated and capped, fetched in parallel. */
export async function keywordSignals(seeds: string[], platform: Platform, suggest: Suggest): Promise<string[]> {
  const unique = [...new Set(seeds.map((s) => s.trim().toLowerCase()).filter(Boolean))].slice(0, 3);
  const lists = await Promise.all(unique.map((s) => suggest(s, platform)));
  return [...new Set(lists.flat())].slice(0, 20);
}
