/**
 * Per-marketplace listing limits and conventions. The pipeline writes to these
 * limits and the validator enforces them in code, so a limit is never left to
 * the model.
 *
 * Values follow each marketplace's public seller guidance at the time of
 * writing; marketplaces change them, so they live in one place to update.
 */
export const PLATFORM_IDS = ["amazon_us", "tiktok_us", "amazon_uk", "amazon_de", "amazon_jp"] as const;
export type Platform = (typeof PLATFORM_IDS)[number];

export interface PlatformRules {
  label: string;
  /** Language the listing is written in. */
  language: string;
  /** Shopper country, for spelling, units and regulation. */
  country: string;
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
  /** The English word lexicon only applies to English listings; other languages rely on the AI review. */
  lexicon: boolean;
  styleNotes: string;
  /** What the compliance review should know about this market's rules. */
  regulatoryNotes: string;
  /** Amazon search-suggestion endpoint for real shopper phrases (none for TikTok). */
  suggest?: { host: string; marketplaceId: string };
}

const AMAZON_TITLE_CHARS = ["!", "$", "?", "_", "{", "}", "^", "¬", "¦"];

export const PLATFORMS: Record<Platform, PlatformRules> = {
  amazon_us: {
    label: "Amazon US",
    language: "American English",
    country: "United States",
    titleMax: 200,
    bulletCount: 5,
    bulletMax: 255,
    descriptionMax: 2000,
    searchTermsMaxBytes: 249,
    titleForbiddenChars: AMAZON_TITLE_CHARS,
    titleMaxWordRepeats: 2,
    lexicon: true,
    styleNotes:
      "Title: Brand + product type + key attributes (material, size, quantity, color), in Title Case, no promotional words. " +
      "Bullets: start each with a short capitalized benefit phrase, then concrete detail. US units first (oz, inches), metric in brackets is fine. " +
      "Backend search terms: lowercase, space separated, no brand names, no words already in the title, no punctuation.",
    regulatoryNotes:
      "US: FDA (drug, device, cosmetic and food-contact claims), EPA/FIFRA (germ, pest and mold claims are pesticide claims), FTC (substantiation, Green Guides for environmental claims, Made in USA), CPSC (children's products need a CPC; no safety claims without testing), FCC for radio devices.",
    suggest: { host: "completion.amazon.com", marketplaceId: "ATVPDKIKX0DER" },
  },
  tiktok_us: {
    label: "TikTok Shop US",
    language: "American English",
    country: "United States",
    titleMax: 255,
    bulletCount: 5,
    bulletMax: 255,
    descriptionMax: 2000,
    searchTermsMaxBytes: 249,
    titleForbiddenChars: ["$", "{", "}", "^"],
    titleMaxWordRepeats: 2,
    lexicon: true,
    styleNotes:
      "Title: product type and the one or two attributes shoppers scroll for, conversational but specific. " +
      "Bullets: short, scannable, benefit first; light, friendly tone suits short-video shoppers. " +
      "Search terms: phrases a viewer would type after seeing the product in a video.",
    regulatoryNotes:
      "US rules as for Amazon US (FDA, EPA/FIFRA, FTC, CPSC). TikTok Shop also prohibits exaggerated or before/after health claims and medical claims in any form.",
  },
  amazon_uk: {
    label: "Amazon UK",
    language: "British English",
    country: "United Kingdom",
    titleMax: 200,
    bulletCount: 5,
    bulletMax: 255,
    descriptionMax: 2000,
    searchTermsMaxBytes: 249,
    titleForbiddenChars: AMAZON_TITLE_CHARS,
    titleMaxWordRepeats: 2,
    lexicon: true,
    styleNotes: "British spelling (colour, organiser, aluminium) and metric units first. Same structure as Amazon US.",
    regulatoryNotes:
      "UK: ASA/CAP code (claims must be substantiated), UKCA/CE marking claims need conformity documents, biocidal claims (antibacterial) fall under GB BPR, cosmetics under UK Cosmetics Regulation, medicinal claims only for licensed medicines (MHRA).",
    suggest: { host: "completion.amazon.co.uk", marketplaceId: "A1F83G8C2ARO7P" },
  },
  amazon_de: {
    label: "Amazon DE",
    language: "German",
    country: "Germany",
    titleMax: 200,
    bulletCount: 5,
    bulletMax: 255,
    descriptionMax: 2000,
    searchTermsMaxBytes: 249,
    titleForbiddenChars: AMAZON_TITLE_CHARS,
    titleMaxWordRepeats: 2,
    lexicon: false,
    styleNotes: "Natural German as a German shopper writes it, formal-neutral (no 'du'), metric units, compound nouns shoppers search for (Aufbewahrungsbox, Faltbecher).",
    regulatoryNotes:
      "Germany/EU: UWG (no misleading or unprovable superlatives such as 'der beste'), HWG (no health claims for non-medicinal products), EU Biocidal Products Regulation (antibakteriell), EU Cosmetics Regulation, CE marking claims need a declaration of conformity, EU Green Claims rules (umweltfreundlich, klimaneutral need proof).",
    suggest: { host: "completion.amazon.de", marketplaceId: "A1PA6795UKMFR9" },
  },
  amazon_jp: {
    label: "Amazon JP",
    language: "Japanese",
    country: "Japan",
    titleMax: 100,
    bulletCount: 5,
    bulletMax: 255,
    descriptionMax: 2000,
    searchTermsMaxBytes: 499,
    titleForbiddenChars: ["!", "$", "?", "{", "}", "^", "¬", "¦", "★", "☆", "【", "】"],
    titleMaxWordRepeats: 2,
    lexicon: false,
    styleNotes: "Natural Japanese a Japanese shopper expects (です・ます in descriptions, concise noun phrases in the title), metric units, full-width characters where natural.",
    regulatoryNotes:
      "Japan: 薬機法 / PMD Act (no efficacy claims for cosmetics or goods beyond the permitted list; no disease claims), 景品表示法 / Premiums and Representations Act (no unprovable '最高' '日本一' 'No.1'), PSE mark for electrical goods, food sanitation rules for food-contact items.",
    suggest: { host: "completion.amazon.co.jp", marketplaceId: "A1VC38T7YXB528" },
  },
};

export function isPlatform(value: unknown): value is Platform {
  return typeof value === "string" && (PLATFORM_IDS as readonly string[]).includes(value);
}
