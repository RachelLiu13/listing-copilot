/**
 * Per-platform listing limits. The pipeline writes to these limits and the
 * validator enforces them in code, so a limit is never left to the model.
 *
 * Values follow the platforms' public seller guidance at the time of writing;
 * platforms change them, so they live in one place to update.
 */
export type Platform = "amazon_us" | "tiktok_us";

export interface PlatformRules {
  label: string;
  titleMax: number;
  bulletCount: number;
  bulletMax: number;
  descriptionMax: number;
  /** Backend search terms limit, in UTF-8 bytes (Amazon counts bytes). */
  searchTermsMaxBytes: number;
  /** Characters a title may not contain. */
  titleForbiddenChars: string[];
  /** A word may appear in the title at most this many times. */
  titleMaxWordRepeats: number;
  styleNotes: string;
}

export const PLATFORMS: Record<Platform, PlatformRules> = {
  amazon_us: {
    label: "Amazon US",
    titleMax: 200,
    bulletCount: 5,
    bulletMax: 255,
    descriptionMax: 2000,
    searchTermsMaxBytes: 249,
    titleForbiddenChars: ["!", "$", "?", "_", "{", "}", "^", "¬", "¦"],
    titleMaxWordRepeats: 2,
    styleNotes:
      "Title: Brand + product type + key attributes (material, size, quantity, color), in Title Case, no promotional words. " +
      "Bullets: start each with a short capitalized benefit phrase, then concrete detail. " +
      "Backend search terms: lowercase, space separated, no brand names, no words already in the title, no punctuation.",
  },
  tiktok_us: {
    label: "TikTok Shop US",
    titleMax: 255,
    bulletCount: 5,
    bulletMax: 255,
    descriptionMax: 2000,
    searchTermsMaxBytes: 249,
    titleForbiddenChars: ["$", "{", "}", "^"],
    titleMaxWordRepeats: 2,
    styleNotes:
      "Title: product type and the one or two attributes shoppers scroll for, conversational but specific. " +
      "Bullets: short, scannable, benefit first; light, friendly tone suits short-video shoppers. " +
      "Search terms: phrases a viewer would type after seeing the product in a video.",
  },
};

export function isPlatform(value: unknown): value is Platform {
  return value === "amazon_us" || value === "tiktok_us";
}
