import { PLATFORMS, type Platform, type PlatformRules } from "../listing/platforms";
import { dedupe, riskScore, RULES_VERSION, scanListing, type CategoryPack, type ComplianceFinding } from "../listing/compliance-rules";
import { copyIssues, enforceLimits } from "../listing/validate";
import { asDataBlock, clean, injectionWarnings } from "../listing/input-guard";
import { keywordSignals, type Suggest } from "../listing/suggest";
import {
  AppealSchema,
  BulletsSchema,
  ComplianceReviewSchema,
  CopySchema,
  GroundingSchema,
  ImageCheckSchema,
  KeywordPlanSchema,
  NativeReviewSchema,
  ProductFactsSchema,
  SectionSchema,
  TermsSchema,
  type AppealResult,
  type AuditInput,
  type ImageCheck,
  type KeywordPlan,
  type ListingCopy,
  type ListingInput,
  type ListingResult,
  type NativeReview,
  type ProductFacts,
  type StepUsage,
  type UnsupportedClaim,
} from "../listing/types";
import type { InputBlock, JsonRequest, LLM } from "./llm";
import * as P from "./prompts";

/**
 * The listing pipeline. Each step is a narrow model call with a schema, with
 * deterministic code between them:
 *
 *   1 extract   seller notes in any language (+photo) -> structured English facts and a
 *               category, or questions in the seller's language if the notes are too thin
 *   2 keywords  facts + real search-box suggestions -> shopper phrases in the market's language
 *               (in parallel: main-image check, when a photo was given)
 *   3 write     facts + keywords + the seller's evidence -> title, bullets, description, terms
 *   4 check     code checks limits; one model repair if needed; code enforces the rest
 *   5 review    category rule pack + AI compliance review + grounding check (parallel),
 *               risk score, then the whole review explained in the seller's own language
 *
 * Step 1 runs before a credit is spent (see the API route), so a seller is
 * never charged for "please tell me more".
 */
export type StepName = "extract" | "keywords" | "write" | "check" | "review" | "explain" | "fix";
export type Progress = (step: StepName, status: "running" | "done", detail?: string) => void;

export const STEP_LABELS: Record<StepName, string> = {
  extract: "Reading your product details",
  keywords: "Planning search keywords",
  write: "Writing the listing",
  check: "Checking marketplace limits",
  review: "Reviewing compliance and facts",
  explain: "Explaining the review in your language",
  fix: "Fixing the problems",
};

export interface Deps {
  llm: LLM;
  /** Marketplace search suggestions; omitted in tests. */
  suggest?: Suggest;
  /** The reader's interface language when it is not English; explanations use it instead of the notes' language. */
  readerLanguage?: string;
}

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
const evidenceBlock = (evidence: string[]) => json("seller_evidence", evidence.length ? evidence : ["(none)"]);
const fieldsOf = (copy: ListingCopy) => ({ title: copy.title, bullets: copy.bullets, description: copy.description, search_terms: copy.searchTerms.join(" ") });
const wholeText = (copy: ListingCopy) => [copy.title, ...copy.bullets, copy.description, copy.searchTerms.join(" ")].join("\n").toLowerCase();
const isEnglish = (language: string) => /english/i.test(language);

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

/** Rule-based findings for a copy, with the market's lexicon, the category pack and the seller's evidence. */
export function ruleFindings(copy: ListingCopy, platform: Platform, pack: CategoryPack, evidence: string[]): ComplianceFinding[] {
  return scanListing(fieldsOf(copy), { pack, evidence, brandsOnly: !PLATFORMS[platform].lexicon });
}

// ---------------------------------------------------------------- step 1

export async function extract(input: ListingInput, deps: Deps, progress: Progress = () => {}): Promise<Extraction> {
  const sellerFields = sellerFieldsOf(input);
  const inputWarnings = injectionWarnings(sellerFields);

  const meter = new Meter();
  progress("extract", "running");
  const content: InputBlock[] = [];
  if (input.image) content.push({ type: "image", mediaType: input.image.mediaType, data: input.image.data });
  content.push(text(`${asDataBlock(sellerFields)}\n\nTarget marketplace: ${PLATFORMS[input.platform].label}.`));

  const facts = await meter.call(deps.llm, { step: "extract", system: P.EXTRACT_SYSTEM, content, schema: ProductFactsSchema, effort: "low", maxTokens: 4000 });
  if (!facts.sufficient) {
    throw new NeedsMoreInfo(facts.missing_questions.length ? facts.missing_questions.slice(0, 4) : ["Please add the material, size or capacity, and the main selling points."]);
  }
  if (sellerFields.brand && !facts.brand) facts.brand = sellerFields.brand;
  progress("extract", "done", `${facts.product_type_en}${facts.input_language ? ` (from ${facts.input_language})` : ""} · ${facts.category_pack.replace("_", " ")} rules`);
  return { facts, sellerFields, inputWarnings, usage: meter.usage };
}

// ---------------------------------------------------------------- steps 2-5

export async function complete(input: ListingInput, ex: Extraction, deps: Deps, progress: Progress = () => {}): Promise<ListingResult> {
  const rules = PLATFORMS[input.platform];
  const meter = new Meter();
  meter.usage.push(...ex.usage);
  const factsBlock = json("product_facts", ex.facts);
  const evidence = input.evidence ?? [];

  progress("keywords", "running");
  const [signals, imageCheck] = await Promise.all([
    deps.suggest ? keywordSignals([ex.facts.product_type_en, ...ex.facts.use_cases.slice(0, 1).map((u) => `${ex.facts.product_type_en} ${u}`)], input.platform, deps.suggest) : Promise.resolve([]),
    input.image ? checkImage(input.image, deps.llm, meter) : Promise.resolve(undefined),
  ]);
  const keywords = await meter.call(deps.llm, {
    step: "keywords",
    system: P.KEYWORDS_SYSTEM(rules),
    content: [text(signals.length ? `${factsBlock}\n\n${json("shopper_search_suggestions", signals)}` : factsBlock)],
    schema: KeywordPlanSchema,
    effort: "low",
    maxTokens: 4000,
  });
  progress("keywords", "done", `${keywords.primary.slice(0, 3).map((k) => k.phrase).join(", ")}${signals.length ? ` · ${signals.length} real search phrases` : ""}`);

  progress("write", "running");
  const draft = await meter.call(deps.llm, {
    step: "write",
    system: P.WRITE_SYSTEM(rules),
    content: [text(`${factsBlock}\n\n${json("keywords", keywords)}\n\n${evidenceBlock(evidence)}`)],
    schema: CopySchema,
    effort: "medium",
    maxTokens: 8000,
  });
  let copy: ListingCopy = { title: draft.title, bullets: draft.bullets, description: draft.description, searchTerms: draft.search_terms };
  progress("write", "done");

  progress("check", "running");
  const { copy: fitted, fixesApplied } = await fitToLimits(copy, rules, ex.facts, deps.llm, meter);
  copy = fitted;
  progress("check", "done", fixesApplied.length ? `${fixesApplied.length} fix(es)` : "within limits");

  progress("review", "running");
  const { compliance, unsupportedClaims } = await review(copy, input.platform, ex.facts, evidence, deps.llm, meter, true);
  const risk = riskScore(compliance, unsupportedClaims.length, ex.facts.category_pack);
  progress("review", "done", `risk ${risk.score}/100 · ${compliance.length} risk(s), ${unsupportedClaims.length} unconfirmed`);

  const result: ListingResult = {
    mode: "generate",
    platform: input.platform,
    facts: ex.facts,
    keywords,
    keywordSignals: signals,
    copy,
    compliance,
    unsupportedClaims,
    risk,
    rulesVersion: RULES_VERSION,
    evidence,
    imageCheck,
    fixesApplied,
    inputWarnings: ex.inputWarnings,
    usage: meter.usage,
  };
  result.native = await explain(result, deps.llm, meter, progress, deps.readerLanguage);
  result.usage = meter.usage;
  return result;
}

async function fitToLimits(copy: ListingCopy, rules: PlatformRules, facts: ProductFacts, llm: LLM, meter: Meter) {
  const fixesApplied: string[] = [];
  const issues = copyIssues(copy, rules);
  if (issues.length) {
    const repaired = await meter.call(llm, {
      step: "repair",
      system: P.REPAIR_SYSTEM(rules),
      content: [text(`${json("listing", fieldsOf(copy))}\n\n${json("problems", issues)}\n\n${json("product_facts", facts)}`)],
      schema: CopySchema,
      effort: "low",
      maxTokens: 8000,
    });
    copy = { title: repaired.title, bullets: repaired.bullets, description: repaired.description, searchTerms: repaired.search_terms };
    fixesApplied.push(...issues.map((i) => `Rewrote ${i.field}: it ${i.problem}.`));
  }
  const before = JSON.stringify(copy);
  copy = enforceLimits(copy, rules, facts.brand);
  if (JSON.stringify(copy) !== before) fixesApplied.push("Trimmed text and cleaned search terms to fit the marketplace limits.");
  return { copy, fixesApplied };
}

async function review(copy: ListingCopy, platform: Platform, facts: ProductFacts | null, evidence: string[], llm: LLM, meter: Meter, grounding: boolean) {
  const rules = PLATFORMS[platform];
  const pack = facts?.category_pack ?? "general";
  const fromRules = ruleFindings(copy, platform, pack, evidence);
  const listingBlock = json("listing", fieldsOf(copy));
  const [aiReview, ground] = await Promise.all([
    meter.call(llm, {
      step: "compliance",
      system: P.COMPLIANCE_SYSTEM(rules),
      content: [text(`${listingBlock}\n\n${json("already_flagged", fromRules.map((f) => ({ field: f.field, text: f.text })))}\n\n${evidenceBlock(evidence)}\n\nProduct category: ${pack}.`)],
      schema: ComplianceReviewSchema,
      effort: "low",
      maxTokens: 4000,
    }),
    grounding && facts
      ? meter.call(llm, { step: "grounding", system: P.GROUNDING_SYSTEM, content: [text(`${listingBlock}\n\n${json("product_facts", facts)}`)], schema: GroundingSchema, effort: "low", maxTokens: 4000 })
      : Promise.resolve({ unsupported: [] as UnsupportedClaim[] }),
  ]);
  const whole = wholeText(copy);
  // Keep only AI findings that quote text actually present in the listing.
  const aiFindings: ComplianceFinding[] = aiReview.findings.filter((f) => f.text && whole.includes(f.text.toLowerCase())).map((f) => ({ ...f, source: "ai" as const }));
  const unsupportedClaims = ground.unsupported.filter((c) => c.text && whole.includes(c.text.toLowerCase()));
  const compliance = dedupe([...fromRules, ...aiFindings]).sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "high" ? -1 : 1));
  return { compliance, unsupportedClaims };
}

/**
 * The review in the seller's own language, with a back-translation: the interface
 * language they chose, else the language of their notes. Skipped for English
 * readers of English listings.
 */
async function explain(result: ListingResult, llm: LLM, meter: Meter, progress: Progress = () => {}, readerLanguage?: string): Promise<NativeReview | undefined> {
  const language = readerLanguage || result.facts.input_language || "English";
  if (isEnglish(language) && /English/.test(PLATFORMS[result.platform].language)) return undefined;
  progress("explain", "running");
  const out = await meter.call(llm, {
    step: "explain",
    system: P.NATIVE_SYSTEM(language),
    content: [
      text(
        `${json("listing", fieldsOf(result.copy))}\n\n${json("findings", result.compliance.map((f) => ({ field: f.field, text: f.text, reason: f.reason, suggestion: f.suggestion })))}\n\n` +
          `${json("unsupported", result.unsupportedClaims)}\n\nRisk score: ${result.risk?.score ?? 0}/100.`,
      ),
    ],
    schema: NativeReviewSchema,
    effort: "low",
    maxTokens: 8000,
  });
  progress("explain", "done", language);
  return {
    language,
    summary: out.summary,
    backTranslation: out.back_translation,
    findingNotes: result.compliance.map((_, i) => out.finding_notes[i] ?? { reason: "", suggestion: "" }),
    unsupportedNotes: result.unsupportedClaims.map((_, i) => out.unsupported_notes[i] ?? ""),
  };
}

/** Refresh the native-language review after edits. */
export async function refreshExplanation(result: ListingResult, llm: LLM, readerLanguage?: string): Promise<{ native: NativeReview | undefined; usage: StepUsage[] }> {
  const meter = new Meter();
  const native = await explain(result, llm, meter, undefined, readerLanguage);
  return { native, usage: meter.usage };
}

async function checkImage(image: NonNullable<ListingInput["image"]>, llm: LLM, meter: Meter): Promise<ImageCheck> {
  const measured = image.borderWhite;
  const out = await meter.call(llm, {
    step: "image",
    system: P.IMAGE_SYSTEM,
    content: [
      { type: "image", mediaType: image.mediaType, data: image.data },
      text(measured === undefined ? "Check this main image." : `<measurement>${Math.round(measured * 100)}% of the border pixels are near-white.</measurement>`),
    ],
    schema: ImageCheckSchema,
    effort: "low",
    maxTokens: 2000,
  });
  const issues = [...out.issues];
  if (measured !== undefined && measured < 0.9 && !issues.some((i) => /background/i.test(i.problem))) {
    issues.unshift({ severity: "high", problem: `Only ${Math.round(measured * 100)}% of the image border is white; the main image needs a pure white background.`, fix: "Remove the background and replace it with pure white (RGB 255, 255, 255)." });
  }
  return { passes: issues.every((i) => i.severity !== "high") && out.shows_product, borderWhite: measured, issues };
}

// ---------------------------------------------------------------- audit an existing listing

export async function audit(input: AuditInput, deps: Deps, progress: Progress = () => {}): Promise<ListingResult> {
  const rules = PLATFORMS[input.platform];
  const meter = new Meter();
  const original: ListingCopy = {
    title: clean(input.title),
    bullets: input.bullets.map(clean).filter(Boolean),
    description: clean(input.description),
    searchTerms: clean(input.searchTerms).split(/\s+/).filter(Boolean),
  };
  const notes = clean(input.productNotes);
  const inputWarnings = injectionWarnings({ listing: wholeText(original), notes });

  progress("extract", "running");
  const facts = await meter.call(deps.llm, {
    step: "extract",
    system: P.AUDIT_EXTRACT_SYSTEM,
    content: [text(`${json("listing", fieldsOf(original))}${notes ? `\n\n${asDataBlock({ product_notes: notes })}` : ""}`)],
    schema: ProductFactsSchema,
    effort: "low",
    maxTokens: 4000,
  });
  progress("extract", "done", `${facts.product_type_en} · ${facts.category_pack.replace("_", " ")} rules`);

  progress("review", "running");
  const before = await review(original, input.platform, facts, input.evidence, deps.llm, meter, Boolean(notes));
  const riskBefore = riskScore(before.compliance, before.unsupportedClaims.length, facts.category_pack);
  progress("review", "done", `risk ${riskBefore.score}/100 before fixes`);

  let copy = original;
  const fixesApplied: string[] = [];
  const needsFix = before.compliance.length > 0 || before.unsupportedClaims.length > 0 || copyIssues(original, rules).length > 0;
  if (needsFix) {
    progress("fix", "running");
    const fixed = await meter.call(deps.llm, {
      step: "fix",
      system: P.AUDIT_FIX_SYSTEM(rules),
      content: [
        text(
          `${json("listing", fieldsOf(original))}\n\n${json("findings", before.compliance.map((f) => ({ field: f.field, text: f.text, reason: f.reason, suggestion: f.suggestion })))}\n\n` +
            `${json("unsupported", before.unsupportedClaims)}\n\n${json("limit_problems", copyIssues(original, rules))}\n\n${evidenceBlock(input.evidence)}\n\n${json("product_facts", facts)}`,
        ),
      ],
      schema: CopySchema,
      effort: "medium",
      maxTokens: 8000,
    });
    const fitted = await fitToLimits({ title: fixed.title, bullets: fixed.bullets, description: fixed.description, searchTerms: fixed.search_terms }, rules, facts, deps.llm, meter);
    copy = fitted.copy;
    fixesApplied.push(`Fixed ${before.compliance.length} risk(s) and ${before.unsupportedClaims.length} unconfirmed claim(s).`, ...fitted.fixesApplied);
    progress("fix", "done");
  }

  // Re-check the fixed copy (rules + AI); the fact check already ran on the original.
  const after = needsFix ? await review(copy, input.platform, facts, input.evidence, deps.llm, meter, false) : before;
  const unsupportedClaims = needsFix ? before.unsupportedClaims.filter((c) => wholeText(copy).includes(c.text.toLowerCase())) : before.unsupportedClaims;
  const risk = riskScore(after.compliance, unsupportedClaims.length, facts.category_pack);

  const result: ListingResult = {
    mode: "audit",
    platform: input.platform,
    facts,
    keywords: { primary: [], secondary: [], avoid: [] } as KeywordPlan,
    copy,
    compliance: after.compliance,
    unsupportedClaims,
    risk,
    rulesVersion: RULES_VERSION,
    evidence: input.evidence,
    original,
    originalCompliance: before.compliance,
    riskBefore,
    fixesApplied,
    inputWarnings,
    usage: meter.usage,
  };
  result.native = await explain(result, deps.llm, meter, progress, deps.readerLanguage);
  result.usage = meter.usage;
  return result;
}

// ---------------------------------------------------------------- appeal assistant

export async function draftAppeal(notice: string, sellerNote: string, listing: ListingResult | null, llm: LLM, readerLanguage?: string): Promise<{ appeal: AppealResult; usage: StepUsage[] }> {
  const meter = new Meter();
  const parts = [`<notice>\n${clean(notice).replace(/<\/?notice>/gi, "")}\n</notice>`];
  if (readerLanguage) parts.push(`Interface language: ${readerLanguage}`);
  if (sellerNote.trim()) parts.push(`<seller_note>\n${clean(sellerNote).replace(/<\/?seller_note>/gi, "")}\n</seller_note>`);
  if (listing) parts.push(json("listing", { marketplace: PLATFORMS[listing.platform].label, ...fieldsOf(listing.copy), seller_evidence: listing.evidence ?? [] }));
  const appeal = await meter.call(llm, { step: "appeal", system: P.APPEAL_SYSTEM, content: [text(parts.join("\n\n"))], schema: AppealSchema, effort: "medium", maxTokens: 6000 });
  return { appeal, usage: meter.usage };
}

// ---------------------------------------------------------------- free re-check after a rules update

/** Re-runs the rule layer under the current RULES_VERSION. No model call. */
export function recheck(result: ListingResult): ListingResult {
  const pack = result.facts.category_pack ?? "general";
  const evidence = result.evidence ?? [];
  const whole = wholeText(result.copy);
  const compliance = dedupe([
    ...ruleFindings(result.copy, result.platform, pack, evidence),
    ...result.compliance.filter((f) => f.source === "ai" && whole.includes(f.text.toLowerCase())),
  ]).sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "high" ? -1 : 1));
  const unsupportedClaims = result.unsupportedClaims.filter((c) => whole.includes(c.text.toLowerCase()));
  const changed = JSON.stringify(compliance) !== JSON.stringify(result.compliance);
  return {
    ...result,
    compliance,
    unsupportedClaims,
    risk: riskScore(compliance, unsupportedClaims.length, pack),
    rulesVersion: RULES_VERSION,
    native: result.native && changed ? { ...result.native, stale: true } : result.native,
  };
}

// ---------------------------------------------------------------- one-section rewrite

export type Section = "title" | "bullets" | "description" | "searchTerms";

export async function rewriteSection(section: Section, current: ListingResult, request: string, llm: LLM): Promise<{ result: ListingResult; usage: StepUsage[] }> {
  const rules: PlatformRules = PLATFORMS[current.platform];
  const meter = new Meter();
  const base = `${json("product_facts", current.facts)}\n\n${json("keywords", current.keywords)}\n\n${evidenceBlock(current.evidence ?? [])}\n\n${json("current_listing", current.copy)}`;
  const ask = request ? `\n\n<seller_request>${clean(request).replace(/<\/?seller_request>/gi, "")}</seller_request>` : "";
  const req = { step: `rewrite_${section}`, system: P.SECTION_SYSTEM(rules, section), content: [text(base + ask)], effort: "medium" as const, maxTokens: 6000 };
  const copy = { ...current.copy };
  if (section === "bullets") copy.bullets = (await meter.call(llm, { ...req, schema: BulletsSchema })).bullets;
  else if (section === "searchTerms") copy.searchTerms = (await meter.call(llm, { ...req, schema: TermsSchema })).search_terms;
  else copy[section] = (await meter.call(llm, { ...req, schema: SectionSchema })).text;

  const fixed = enforceLimits(copy, rules, current.facts.brand);
  const updated = recheck({ ...current, copy: fixed });
  return { result: { ...updated, native: updated.native ? { ...updated.native, stale: true } : undefined, usage: [...current.usage, ...meter.usage] }, usage: meter.usage };
}
