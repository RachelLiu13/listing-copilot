import { PLATFORMS, type PlatformRules } from "../listing/platforms";
import { dedupe, scanListing, type ComplianceFinding } from "../listing/compliance-rules";
import { copyIssues, enforceLimits } from "../listing/validate";
import { asDataBlock, clean, injectionWarnings } from "../listing/input-guard";
import {
  BulletsSchema,
  ComplianceReviewSchema,
  CopySchema,
  GroundingSchema,
  KeywordPlanSchema,
  ProductFactsSchema,
  SectionSchema,
  TermsSchema,
  type ListingCopy,
  type ListingInput,
  type ListingResult,
  type ProductFacts,
  type StepUsage,
} from "../listing/types";
import type { InputBlock, JsonRequest, LLM } from "./llm";
import * as P from "./prompts";

/**
 * The listing pipeline. Five steps, each a narrow model call with a schema,
 * plus deterministic code between them:
 *
 *   1 extract   seller notes in any language (+photo) -> structured English facts,
 *               or questions in the seller's language if the notes are too thin
 *   2 keywords  facts -> US search phrases
 *   3 write     facts + keywords -> title, bullets, description, search terms
 *   4 check     code checks limits; one model repair if needed; code enforces the rest
 *   5 review    rule lexicon + model compliance review + grounding check (in parallel)
 *
 * Step 1 runs before a credit is spent (see the API route), so a seller is
 * never charged for "please tell me more".
 */
export type StepName = "extract" | "keywords" | "write" | "check" | "review";
export type Progress = (step: StepName, status: "running" | "done", detail?: string) => void;

export const STEP_LABELS: Record<StepName, string> = {
  extract: "Reading your product details",
  keywords: "Planning US search keywords",
  write: "Writing the listing",
  check: "Checking platform limits",
  review: "Reviewing compliance and facts",
};

export interface Extraction {
  facts: ProductFacts;
  sellerFields: Record<string, string>;
  inputWarnings: string[];
  usage: StepUsage[];
}

export class NeedsMoreInfo extends Error {
  constructor(public questions: string[]) {
    super("More product information is needed");
    this.name = "NeedsMoreInfo";
  }
}

class Meter {
  usage: StepUsage[] = [];
  async call<T>(llm: LLM, req: JsonRequest<T>): Promise<T> {
    const res = await llm.json(req);
    this.usage.push({ step: req.step, ms: res.usage.ms, inputTokens: res.usage.inputTokens, outputTokens: res.usage.outputTokens, attempts: res.usage.attempts });
    return res.data;
  }
}

const text = (t: string): InputBlock => ({ type: "text", text: t });
const json = (label: string, value: unknown) => `<${label}>\n${JSON.stringify(value, null, 1)}\n</${label}>`;

export function sellerFieldsOf(input: ListingInput): Record<string, string> {
  return {
    product_name: clean(input.productName),
    brand: clean(input.brand),
    selling_points: clean(input.sellingPoints),
    material: clean(input.material),
    size_or_capacity: clean(input.dimensions),
    target_customers: clean(input.targetAudience),
    other_notes: clean(input.notes),
  };
}

// ---------------------------------------------------------------- step 1

export async function extract(input: ListingInput, llm: LLM, progress: Progress = () => {}): Promise<Extraction> {
  const sellerFields = sellerFieldsOf(input);
  const inputWarnings = injectionWarnings(sellerFields);

  const meter = new Meter();
  progress("extract", "running");
  const content: InputBlock[] = [];
  if (input.image) content.push({ type: "image", mediaType: input.image.mediaType, data: input.image.data });
  content.push(text(`${asDataBlock(sellerFields)}\n\nTarget marketplace: ${PLATFORMS[input.platform].label}.`));

  const facts = await meter.call(llm, { step: "extract", system: P.EXTRACT_SYSTEM, content, schema: ProductFactsSchema, effort: "low", maxTokens: 4000 });
  if (!facts.sufficient) {
    throw new NeedsMoreInfo(facts.missing_questions.length ? facts.missing_questions.slice(0, 4) : ["Please add the material, size or capacity, and the main selling points."]);
  }
  if (sellerFields.brand && !facts.brand) facts.brand = sellerFields.brand;
  progress("extract", "done", facts.input_language ? `${facts.product_type_en} (from ${facts.input_language})` : facts.product_type_en);
  return { facts, sellerFields, inputWarnings, usage: meter.usage };
}

// ---------------------------------------------------------------- steps 2-5

export async function complete(input: ListingInput, ex: Extraction, llm: LLM, progress: Progress = () => {}): Promise<ListingResult> {
  const rules = PLATFORMS[input.platform];
  const meter = new Meter();
  meter.usage.push(...ex.usage);
  const factsBlock = json("product_facts", ex.facts);

  progress("keywords", "running");
  const keywords = await meter.call(llm, { step: "keywords", system: P.KEYWORDS_SYSTEM(rules), content: [text(factsBlock)], schema: KeywordPlanSchema, effort: "low", maxTokens: 4000 });
  progress("keywords", "done", keywords.primary.slice(0, 3).map((k) => k.phrase).join(", "));

  progress("write", "running");
  const draft = await meter.call(llm, {
    step: "write",
    system: P.WRITE_SYSTEM(rules),
    content: [text(`${factsBlock}\n\n${json("keywords", keywords)}`)],
    schema: CopySchema,
    effort: "medium",
    maxTokens: 8000,
  });
  let copy: ListingCopy = { title: draft.title, bullets: draft.bullets, description: draft.description, searchTerms: draft.search_terms };
  progress("write", "done");

  progress("check", "running");
  const fixesApplied: string[] = [];
  const issues = copyIssues(copy, rules);
  if (issues.length) {
    const repaired = await meter.call(llm, {
      step: "repair",
      system: P.REPAIR_SYSTEM(rules),
      content: [text(`${json("listing", draft)}\n\n${json("problems", issues)}\n\n${factsBlock}`)],
      schema: CopySchema,
      effort: "low",
      maxTokens: 8000,
    });
    copy = { title: repaired.title, bullets: repaired.bullets, description: repaired.description, searchTerms: repaired.search_terms };
    fixesApplied.push(...issues.map((i) => `Rewrote ${i.field}: it ${i.problem}.`));
  }
  const before = JSON.stringify(copy);
  copy = enforceLimits(copy, rules, ex.facts.brand);
  if (JSON.stringify(copy) !== before) fixesApplied.push("Trimmed text and cleaned search terms to fit the platform limits.");
  progress("check", "done", fixesApplied.length ? `${fixesApplied.length} fix(es)` : "within limits");

  progress("review", "running");
  const { compliance, unsupportedClaims } = await review(copy, ex.facts, llm, meter);
  progress("review", "done", `${compliance.length} risk(s), ${unsupportedClaims.length} unconfirmed claim(s)`);

  return {
    platform: input.platform,
    facts: ex.facts,
    keywords,
    copy,
    compliance,
    unsupportedClaims,
    fixesApplied,
    inputWarnings: ex.inputWarnings,
    usage: meter.usage,
  };
}

async function review(copy: ListingCopy, facts: ProductFacts, llm: LLM, meter: Meter) {
  const ruleFindings = scanListing({ title: copy.title, bullets: copy.bullets, description: copy.description, search_terms: copy.searchTerms.join(" ") });
  const listingBlock = json("listing", { title: copy.title, bullets: copy.bullets, description: copy.description, search_terms: copy.searchTerms.join(" ") });
  const [aiReview, grounding] = await Promise.all([
    meter.call(llm, {
      step: "compliance",
      system: P.COMPLIANCE_SYSTEM,
      content: [text(`${listingBlock}\n\n${json("already_flagged", ruleFindings.map((f) => ({ field: f.field, text: f.text })))}`)],
      schema: ComplianceReviewSchema,
      effort: "low",
      maxTokens: 4000,
    }),
    meter.call(llm, {
      step: "grounding",
      system: P.GROUNDING_SYSTEM,
      content: [text(`${listingBlock}\n\n${json("product_facts", facts)}`)],
      schema: GroundingSchema,
      effort: "low",
      maxTokens: 4000,
    }),
  ]);
  const whole = [copy.title, ...copy.bullets, copy.description, copy.searchTerms.join(" ")].join("\n").toLowerCase();
  // Keep only AI findings that quote text actually present in the listing.
  const aiFindings: ComplianceFinding[] = aiReview.findings
    .filter((f) => f.text && whole.includes(f.text.toLowerCase()))
    .map((f) => ({ ...f, source: "ai" as const }));
  const unsupportedClaims = grounding.unsupported.filter((c) => c.text && whole.includes(c.text.toLowerCase()));
  const compliance = dedupe([...ruleFindings, ...aiFindings]).sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "high" ? -1 : 1));
  return { compliance, unsupportedClaims };
}

// ---------------------------------------------------------------- one-section rewrite

export type Section = "title" | "bullets" | "description" | "searchTerms";

export async function rewriteSection(
  section: Section,
  current: ListingResult,
  request: string,
  llm: LLM,
): Promise<{ copy: ListingCopy; compliance: ComplianceFinding[]; usage: StepUsage[] }> {
  const rules: PlatformRules = PLATFORMS[current.platform];
  const meter = new Meter();
  const base = `${json("product_facts", current.facts)}\n\n${json("keywords", current.keywords)}\n\n${json("current_listing", current.copy)}`;
  const ask = request ? `\n\n<seller_request>${clean(request).replace(/<\/?seller_request>/gi, "")}</seller_request>` : "";
  const req = { step: `rewrite_${section}`, system: P.SECTION_SYSTEM(rules, section), content: [text(base + ask)], effort: "medium" as const, maxTokens: 6000 };
  const copy = { ...current.copy };
  if (section === "bullets") copy.bullets = (await meter.call(llm, { ...req, schema: BulletsSchema })).bullets;
  else if (section === "searchTerms") copy.searchTerms = (await meter.call(llm, { ...req, schema: TermsSchema })).search_terms;
  else copy[section] = (await meter.call(llm, { ...req, schema: SectionSchema })).text;

  const fixed = enforceLimits(copy, rules, current.facts.brand);
  const compliance = dedupe([
    ...scanListing({ title: fixed.title, bullets: fixed.bullets, description: fixed.description, search_terms: fixed.searchTerms.join(" ") }),
    ...current.compliance.filter((f) => f.source === "ai" && fieldText(fixed, f.field).toLowerCase().includes(f.text.toLowerCase())),
  ]);
  return { copy: fixed, compliance, usage: meter.usage };
}

function fieldText(copy: ListingCopy, field: string): string {
  const m = field.match(/^bullets\[(\d)\]$/);
  if (m) return copy.bullets[Number(m[1])] ?? "";
  if (field === "title") return copy.title;
  if (field === "description") return copy.description;
  if (field === "search_terms") return copy.searchTerms.join(" ");
  return "";
}
