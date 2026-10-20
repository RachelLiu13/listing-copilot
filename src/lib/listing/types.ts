import { z } from "zod";
import type { Platform } from "./platforms";
import type { ComplianceFinding } from "./compliance-rules";

/** What the seller types in, in any language. */
export const ListingInputSchema = z.object({
  platform: z.enum(["amazon_us", "tiktok_us"]),
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
    })
    .optional(),
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

export interface ListingResult {
  platform: Platform;
  facts: ProductFacts;
  keywords: KeywordPlan;
  copy: ListingCopy;
  compliance: ComplianceFinding[];
  unsupportedClaims: UnsupportedClaim[];
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
