import type { PlatformRules } from "./platforms";
import type { ListingCopy } from "./types";

/** Deterministic checks on generated copy. Limits are enforced here, not trusted to the model. */
export interface CopyIssue {
  field: string;
  problem: string;
}

export const byteLength = (s: string) => new TextEncoder().encode(s).length;

/** Words in any script (Latin with accents, German umlauts, Japanese, ...). */
export const words = (s: string) => s.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];

/** Cut at the last whole word that fits, without trailing punctuation. */
export function truncateAtWord(s: string, max: number): string {
  if (s.length <= max) return s;
  const cut = s.slice(0, max + 1);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : s.slice(0, max)).replace(/[\s,;:.\-–—]+$/, "");
}

export function titleIssues(title: string, rules: PlatformRules): CopyIssue[] {
  const issues: CopyIssue[] = [];
  if (title.length > rules.titleMax) issues.push({ field: "title", problem: `is ${title.length} characters; the limit is ${rules.titleMax}` });
  const bad = rules.titleForbiddenChars.filter((c) => title.includes(c));
  if (bad.length) issues.push({ field: "title", problem: `contains characters the platform rejects: ${bad.join(" ")}` });
  const counts = new Map<string, number>();
  for (const word of words(title)) {
    if (word.length < 3 && /^[\p{Script=Latin}\p{N}]+$/u.test(word)) continue; // "and", "for" and units are fine to repeat
    counts.set(word, (counts.get(word) ?? 0) + 1);
  }
  const repeated = [...counts].filter(([, n]) => n > rules.titleMaxWordRepeats).map(([word]) => word);
  if (repeated.length) issues.push({ field: "title", problem: `repeats words more than ${rules.titleMaxWordRepeats} times: ${repeated.join(", ")}` });
  return issues;
}

export function copyIssues(copy: ListingCopy, rules: PlatformRules): CopyIssue[] {
  const issues = titleIssues(copy.title, rules);
  if (copy.bullets.length !== rules.bulletCount) issues.push({ field: "bullets", problem: `has ${copy.bullets.length} bullets; expected ${rules.bulletCount}` });
  copy.bullets.forEach((b, i) => {
    if (b.length > rules.bulletMax) issues.push({ field: `bullets[${i}]`, problem: `is ${b.length} characters; the limit is ${rules.bulletMax}` });
  });
  if (copy.description.length > rules.descriptionMax) issues.push({ field: "description", problem: `is ${copy.description.length} characters; the limit is ${rules.descriptionMax}` });
  const terms = copy.searchTerms.join(" ");
  if (byteLength(terms) > rules.searchTermsMaxBytes) issues.push({ field: "searchTerms", problem: `is ${byteLength(terms)} bytes; the limit is ${rules.searchTermsMaxBytes}` });
  return issues;
}

/**
 * Backend search terms: lowercase, no punctuation, no words already in the
 * title (they are indexed anyway), no duplicates, within the byte limit.
 */
export function normalizeSearchTerms(terms: string[], title: string, maxBytes: number, brand?: string): string[] {
  const titleWords = new Set(words(title));
  const brandWords = new Set(words(brand ?? ""));
  const seen = new Set<string>();
  const out: string[] = [];
  let bytes = 0;
  for (const term of terms) {
    const kept = words(term).filter((w) => !titleWords.has(w) && !brandWords.has(w) && !seen.has(w));
    if (!kept.length) continue;
    const phrase = kept.join(" ");
    const add = byteLength(phrase) + (out.length ? 1 : 0);
    if (bytes + add > maxBytes) continue;
    kept.forEach((w) => seen.add(w));
    out.push(phrase);
    bytes += add;
  }
  return out;
}

/** Last-resort fixes after the model's repair attempt: always leaves copy within limits. */
export function enforceLimits(copy: ListingCopy, rules: PlatformRules, brand?: string): ListingCopy {
  let title = copy.title;
  for (const c of rules.titleForbiddenChars) title = title.split(c).join("");
  title = truncateAtWord(title.replace(/\s+/g, " ").trim(), rules.titleMax);
  const bullets = copy.bullets.slice(0, rules.bulletCount).map((b) => truncateAtWord(b.trim(), rules.bulletMax));
  return {
    title,
    bullets,
    description: truncateAtWord(copy.description.trim(), rules.descriptionMax),
    searchTerms: normalizeSearchTerms(copy.searchTerms, title, rules.searchTermsMaxBytes, brand),
  };
}
