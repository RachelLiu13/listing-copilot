import { z } from "zod";
import { PLATFORM_IDS, type Platform } from "./platforms";
import { CATEGORY_PACKS, type CategoryPack, type ComplianceFinding, type RiskScore } from "./compliance-rules";

/** What the seller types in, in any language. */
export const ListingInputSchema = z.object({
  platform: z.enum(PLATFORM_IDS),
  productName: z.string().trim().min(1, "Product name is required").max(200),
  brand: z.string().trim().max(100).optional().default(""),
  sellingPoints: z.string().trim().max(3000).optional().default(""),
  material: z.string().trim().max(300).optional().default(""),
  dimensions: z.string().trim().max(300).optional().default(""),
  targetAudience: z.string().trim().max(300).optional().default(""),
  notes: z.string().trim().max(2000).optional().default(""),
  image: z
    .object({
      mediaType: z.enum(["image/jpeg", "image/png", "image/webp"]),
      // Base64, resized in the browser to ≤1024px, so well under this cap.
      data: z.string().max(3_000_000),
      // Share of near-white pixels along the photo's border, measured in the browser (0-1).
      borderWhite: z.number().min(0).max(1).optional(),
    })
    .optional(),
  /** Documents the seller holds (from their evidence library), e.g. "FDA 21 CFR food-contact test report". */
  evidence: z.array(z.string().trim().max(200)).max(20).optional().default([]),
});
export type ListingInput = z.infer<typeof ListingInputSchema>;

/** The final copy, as shown and exported. */
export interface ListingCopy {
  title: string;
  bullets: string[];
  description: string;
  searchTerms: string[];
}

export interface UnsupportedClaim {
  field: string;
  text: string;
  reason: string;
}

export interface StepUsage {
  step: string;
  ms: number;
  inputTokens: number;
  outputTokens: number;
  attempts: number;
}

/** The review explained in the seller's own language, plus a back-translation of the listing. */
export interface NativeReview {
  language: string;
  summary: string;
  backTranslation: { title: string; bullets: string[]; description: string };
  /** One note per compliance finding, same order. */
  findingNotes: { reason: string; suggestion: string }[];
  /** One note per unsupported claim, same order. */
  unsupportedNotes: string[];
  /** True after the copy changed (edit or rewrite) until the review is refreshed. */
  stale?: boolean;
}

export interface ImageCheck {
  passes: boolean;
  borderWhite?: number;
  issues: { severity: "high" | "medium"; problem: string; fix: string }[];
}

export interface ListingResult {
  mode?: "generate" | "audit";
  platform: Platform;
  facts: ProductFacts;
  keywords: KeywordPlan;
  /** Real shopper phrases from the marketplace's search suggestions, when available. */
  keywordSignals?: string[];
  copy: ListingCopy;
  compliance: ComplianceFinding[];
  unsupportedClaims: UnsupportedClaim[];
  risk?: RiskScore;
  rulesVersion?: number;
  evidence?: string[];
  native?: NativeReview;
  imageCheck?: ImageCheck;
  /** Audit mode: the listing as the seller pasted it, and its risk before the fix. */
  original?: ListingCopy;
  originalCompliance?: ComplianceFinding[];
  riskBefore?: RiskScore;
  fixesApplied: string[];
  inputWarnings: string[];
  usage: StepUsage[];
}

// ---- Model outputs (schemas are sent to the API as structured-output JSON Schemas) ----

export const ProductFactsSchema = z.strictObject({
  sufficient: z.boolean(),
  missing_questions: z.array(z.string()),
  input_language: z.string(),
  category: z.string(),
  category_pack: z.enum(CATEGORY_PACKS),
  product_type_en: z.string(),
  brand: z.string(),
  materials: z.array(z.string()),
  dimensions: z.array(z.string()),
  quantity: z.string(),
  colors: z.array(z.string()),
  key_features: z.array(z.string()),
  use_cases: z.array(z.string()),
  target_customers: z.array(z.string()),
  stated_certifications: z.array(z.string()),
});
export type ProductFacts = z.infer<typeof ProductFactsSchema>;

export const KeywordPlanSchema = z.strictObject({
  primary: z.array(z.strictObject({ phrase: z.string(), why: z.string() })),
  secondary: z.array(z.string()),
  avoid: z.array(z.strictObject({ phrase: z.string(), why: z.string() })),
});
export type KeywordPlan = z.infer<typeof KeywordPlanSchema>;

export const CopySchema = z.strictObject({
  title: z.string(),
  bullets: z.array(z.string()),
  description: z.string(),
  search_terms: z.array(z.string()),
});

export const ComplianceReviewSchema = z.strictObject({
  findings: z.array(
    z.strictObject({
      field: z.string(),
      text: z.string(),
      category: z.enum(["medical_claim", "pesticide_claim", "unverifiable_claim", "promotional", "trademark", "environmental_claim", "contact_info"]),
      severity: z.enum(["high", "medium"]),
      reason: z.string(),
      suggestion: z.string(),
    }),
  ),
});

export const GroundingSchema = z.strictObject({
  unsupported: z.array(z.strictObject({ field: z.string(), text: z.string(), reason: z.string() })),
});

export const SectionSchema = z.strictObject({ text: z.string() });
export const BulletsSchema = z.strictObject({ bullets: z.array(z.string()) });
export const TermsSchema = z.strictObject({ search_terms: z.array(z.string()) });

export const NativeReviewSchema = z.strictObject({
  summary: z.string(),
  back_translation: z.strictObject({ title: z.string(), bullets: z.array(z.string()), description: z.string() }),
  finding_notes: z.array(z.strictObject({ reason: z.string(), suggestion: z.string() })),
  unsupported_notes: z.array(z.string()),
});

export const ImageCheckSchema = z.strictObject({
  shows_product: z.boolean(),
  background: z.enum(["pure_white", "near_white", "other"]),
  text_logo_or_watermark: z.boolean(),
  props_or_extra_items: z.boolean(),
  product_fill: z.enum(["under_60", "60_to_85", "over_85"]),
  issues: z.array(z.strictObject({ severity: z.enum(["high", "medium"]), problem: z.string(), fix: z.string() })),
});

export const AppealSchema = z.strictObject({
  seller_language: z.string(),
  policy_area: z.string(),
  what_happened: z.string(),
  likely_cause: z.string(),
  fix_steps: z.array(z.string()),
  listing_changes: z.array(z.strictObject({ field: z.string(), change: z.string() })),
  documents_needed: z.array(z.string()),
  appeal_text: z.string(),
});
export type AppealResult = z.infer<typeof AppealSchema>;

/** A listing pasted in for an audit. */
export const AuditInputSchema = z.object({
  platform: z.enum(PLATFORM_IDS),
  title: z.string().trim().min(1, "Paste the listing title").max(500),
  bullets: z.array(z.string().trim().max(1000)).max(10).default([]),
  description: z.string().trim().max(5000).optional().default(""),
  searchTerms: z.string().trim().max(1000).optional().default(""),
  /** Optional: what the product really is, in any language. Enables the fact check. */
  productNotes: z.string().trim().max(3000).optional().default(""),
  evidence: z.array(z.string().trim().max(200)).max(20).optional().default([]),
});
export type AuditInput = z.infer<typeof AuditInputSchema>;

export type { CategoryPack };
