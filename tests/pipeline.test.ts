import { describe, expect, it } from "vitest";
import { audit, complete, draftAppeal, extract, NeedsMoreInfo, recheck, rewriteSection } from "@/lib/ai/pipeline";
import type { JsonRequest, JsonResult, LLM } from "@/lib/ai/llm";
import { AIError } from "@/lib/ai/llm";
import { AuditInputSchema, ListingInputSchema, type ProductFacts } from "@/lib/listing/types";
import { RULES_VERSION } from "@/lib/listing/compliance-rules";

/** A scripted model: answers by step name and records every call. */
function fakeLLM(answers: Record<string, unknown | (() => unknown)>) {
  const calls: string[] = [];
  const llm: LLM = {
    async json<T>(req: JsonRequest<T>): Promise<JsonResult<T>> {
      calls.push(req.step);
      const a = answers[req.step];
      if (a === undefined) throw new Error(`unexpected step ${req.step}`);
      const value = typeof a === "function" ? (a as () => unknown)() : a;
      return { data: req.schema.parse(value), usage: { inputTokens: 100, outputTokens: 50, ms: 1, attempts: 1 } };
    },
  };
  return { llm, calls, deps: { llm } };
}

const input = ListingInputSchema.parse({
  platform: "amazon_us",
  productName: "硅胶折叠水杯",
  sellingPoints: "可折叠，压缩后2cm，带挂钩，食品级硅胶，最好的水杯",
  material: "硅胶",
  dimensions: "350ml",
});

const facts: ProductFacts = {
  sufficient: true,
  missing_questions: [],
  input_language: "Chinese",
  category: "Kitchen",
  category_pack: "food_contact",
  product_type_en: "collapsible silicone water cup",
  brand: "",
  materials: ["food-grade silicone"],
  dimensions: ["350 ml"],
  quantity: "1",
  colors: [],
  key_features: ["folds to 2 cm", "hanging hook"],
  use_cases: ["camping"],
  target_customers: ["campers"],
  stated_certifications: ["food grade"],
};
const english = { ...facts, input_language: "English" };

const keywords = { primary: [{ phrase: "collapsible cup", why: "common term" }], secondary: ["camping cup"], avoid: [] };

const goodCopy = {
  title: "Collapsible Silicone Water Cup, 350 ml Foldable Travel Cup with Hanging Hook for Camping",
  bullets: ["Folds to 2 cm", "Hanging hook", "350 ml capacity", "Food-grade silicone", "Best for camping trips"],
  description: "A collapsible cup made of food-grade silicone. It is waterproof and folds flat.",
  search_terms: ["camping mug", "hiking cup"],
};

const explainAnswer = {
  summary: "可以发布，但要删掉一个夸大的词。",
  back_translation: { title: "可折叠硅胶水杯", bullets: ["折叠到2厘米"], description: "一个硅胶杯。" },
  finding_notes: [{ reason: "最高级用词不能用", suggestion: "改成具体事实" }],
  unsupported_notes: ["你没说过防水"],
};

describe("step 1: extract", () => {
  it("asks follow-up questions in the seller's own language when the notes are too thin", async () => {
    const { deps, calls } = fakeLLM({ extract: { ...facts, sufficient: false, input_language: "Spanish", missing_questions: ["¿De qué material es?", "¿Qué capacidad tiene?"] } });
    const thin = ListingInputSchema.parse({ platform: "amazon_us", productName: "taza" });
    const err = await extract(thin, deps).catch((e) => e);
    expect(err).toBeInstanceOf(NeedsMoreInfo);
    expect(err.questions).toEqual(["¿De qué material es?", "¿Qué capacidad tiene?"]);
    expect(calls).toEqual(["extract"]);
  });

  it("falls back to an English question if the model gives none", async () => {
    const { deps } = fakeLLM({ extract: { ...facts, sufficient: false, missing_questions: [] } });
    const err = await extract(input, deps).catch((e) => e);
    expect(err.questions[0]).toMatch(/material/);
  });
});

describe("steps 2-5: complete", () => {
  it("repairs a draft that breaks limits, reviews it, scores it and explains it in the seller's language", async () => {
    const tooLong = { ...goodCopy, title: "Cup! " + "Collapsible Silicone ".repeat(20) };
    const { deps, calls } = fakeLLM({
      extract: facts,
      keywords,
      write: tooLong,
      repair: goodCopy,
      compliance: {
        findings: [
          { field: "description", text: "waterproof", category: "unverifiable_claim", severity: "medium", reason: "needs proof", suggestion: "remove" },
          // Quotes text that is not in the listing: must be dropped, not shown.
          { field: "title", text: "kills germs", category: "pesticide_claim", severity: "high", reason: "x", suggestion: "y" },
        ],
      },
      grounding: { unsupported: [{ field: "description", text: "It is waterproof", reason: "the seller never said waterproof" }] },
      explain: explainAnswer,
    });
    const ex = await extract(input, deps);
    const result = await complete(input, ex, deps);

    expect(calls).toEqual(["extract", "keywords", "write", "repair", "compliance", "grounding", "explain"]);
    expect(result.copy.title).toBe(goodCopy.title);
    expect(result.fixesApplied.length).toBeGreaterThan(0);
    expect(result.compliance.map((f) => `${f.source}:${f.text}`)).toEqual(expect.arrayContaining(["rule:Best", "ai:waterproof"]));
    expect(result.compliance.some((f) => f.text === "kills germs")).toBe(false);
    expect(result.unsupportedClaims).toHaveLength(1);
    expect(result.copy.searchTerms.join(" ")).not.toMatch(/\bcup\b/);
    expect(result.risk?.score).toBeGreaterThan(0);
    expect(result.rulesVersion).toBe(RULES_VERSION);
    expect(result.native?.language).toBe("Chinese");
    expect(result.native?.findingNotes).toHaveLength(result.compliance.length);
  });

  it("skips the repair and the explanation for an English seller with a clean draft", async () => {
    const { deps, calls } = fakeLLM({ extract: english, keywords, write: goodCopy, compliance: { findings: [] }, grounding: { unsupported: [] } });
    const ex = await extract(input, deps);
    const result = await complete(input, ex, deps);
    expect(calls).not.toContain("repair");
    expect(calls).not.toContain("explain");
    expect(result.native).toBeUndefined();
  });

  it("explains in the interface language the reader chose, even when they wrote in English", async () => {
    const { llm, calls } = fakeLLM({ extract: english, keywords, write: goodCopy, compliance: { findings: [] }, grounding: { unsupported: [] }, explain: explainAnswer });
    const deps = { llm, readerLanguage: "Japanese" };
    const result = await complete(input, await extract(input, deps), deps);
    expect(calls).toContain("explain");
    expect(result.native?.language).toBe("Japanese");
  });

  it("feeds real search-box phrases to the keyword step and keeps them", async () => {
    const seen: string[] = [];
    const { llm } = fakeLLM({ extract: english, keywords, write: goodCopy, compliance: { findings: [] }, grounding: { unsupported: [] } });
    const spy: LLM = {
      json: (req) => {
        if (req.step === "keywords") seen.push(req.content.map((b) => (b.type === "text" ? b.text : "")).join(""));
        return llm.json(req);
      },
    };
    const deps = { llm: spy, suggest: async () => ["collapsible water cup for travel", "silicone camping cup"] };
    const ex = await extract(input, deps);
    const result = await complete(input, ex, deps);
    expect(result.keywordSignals).toContain("silicone camping cup");
    expect(seen[0]).toContain("shopper_search_suggestions");
  });

  it("checks the main image in parallel and flags a non-white border", async () => {
    const { deps, calls } = fakeLLM({
      extract: english,
      keywords,
      write: goodCopy,
      compliance: { findings: [] },
      grounding: { unsupported: [] },
      image: { shows_product: true, background: "other", text_logo_or_watermark: false, props_or_extra_items: false, product_fill: "60_to_85", issues: [] },
    });
    const withImage = ListingInputSchema.parse({ ...input, image: { mediaType: "image/jpeg", data: "aGVsbG8=", borderWhite: 0.4 } });
    const ex = await extract(withImage, deps);
    const result = await complete(withImage, ex, deps);
    expect(calls).toContain("image");
    expect(result.imageCheck?.passes).toBe(false);
    expect(result.imageCheck?.issues[0].problem).toMatch(/40%/);
  });

  it("lets model errors propagate so the route can refund the credit", async () => {
    const { deps } = fakeLLM({
      extract: facts,
      keywords: () => {
        throw new AIError("rate_limited", "busy", "keywords");
      },
    });
    const ex = await extract(input, deps);
    await expect(complete(input, ex, deps)).rejects.toMatchObject({ kind: "rate_limited" });
  });
});

describe("audit an existing listing", () => {
  it("scores the original, fixes it, and re-checks the fix", async () => {
    const { deps, calls } = fakeLLM({
      extract: { ...english, category_pack: "cleaning" },
      compliance: { findings: [] },
      fix: { title: "Kitchen Sponge, Pack of 6", bullets: ["Lifts grease and grime", "Pack of 6", "Non-scratch", "Dries fast", "For dishes"], description: "Sponges for everyday dishes.", search_terms: ["scrubber"] },
    });
    const auditInput = AuditInputSchema.parse({ platform: "amazon_us", title: "Antibacterial Kitchen Sponge Kills 99.9% of Germs, Best Seller", bullets: ["Kills 99.9% of germs"] });
    const result = await audit(auditInput, deps);
    expect(result.mode).toBe("audit");
    expect(result.riskBefore?.level).toBe("high");
    expect(result.risk!.score).toBeLessThan(result.riskBefore!.score);
    expect(result.original?.title).toMatch(/Antibacterial/);
    expect(result.copy.title).not.toMatch(/Antibacterial/i);
    expect(calls).toContain("fix");
    expect(calls).not.toContain("grounding"); // no product notes given: no fact check
    expect(calls).not.toContain("explain"); // English reader
  });
});

describe("appeal assistant", () => {
  it("returns the structured explanation and appeal", async () => {
    const answer = {
      seller_language: "Vietnamese",
      policy_area: "Pesticide",
      what_happened: "Listing bị ẩn",
      likely_cause: "Từ antibacterial",
      fix_steps: ["Xoá từ antibacterial"],
      listing_changes: [{ field: "title", change: "remove 'Antibacterial'" }],
      documents_needed: [],
      appeal_text: "Dear Seller Performance team, ...",
    };
    const { llm, calls } = fakeLLM({ appeal: answer });
    const out = await draftAppeal("Your listing has been removed because it makes pesticide claims...", "sao listing của tôi bị ẩn?", null, llm);
    expect(out.appeal.seller_language).toBe("Vietnamese");
    expect(calls).toEqual(["appeal"]);
  });
});

describe("recheck and rewriteSection", () => {
  it("rewrites one section, re-checks it and marks the translation stale", async () => {
    const { deps } = fakeLLM({ extract: facts, keywords, write: goodCopy, compliance: { findings: [] }, grounding: { unsupported: [] }, explain: explainAnswer });
    const ex = await extract(input, deps);
    const current = await complete(input, ex, deps);
    const { llm } = fakeLLM({ rewrite_bullets: { bullets: ["Folds to 2 cm", "Hook", "350 ml", "Silicone", "Great for camping"] } });
    const out = await rewriteSection("bullets", current, "drop the superlative", llm);
    expect(out.result.copy.bullets[4]).toBe("Great for camping");
    expect(out.result.copy.title).toBe(current.copy.title);
    expect(out.result.compliance.some((f) => f.text === "Best")).toBe(false);
    expect(out.result.native?.stale).toBe(true);
  });

  it("re-checks an old listing under the current rules without a model call", async () => {
    const { deps } = fakeLLM({ extract: { ...english, category_pack: "pet" }, keywords, write: { ...goodCopy, description: "Keeps fleas away from your dog." }, compliance: { findings: [] }, grounding: { unsupported: [] } });
    const ex = await extract(input, deps);
    const current = await complete(input, ex, deps);
    const old = { ...current, compliance: [], rulesVersion: 1, risk: undefined };
    const fresh = recheck(old);
    expect(fresh.rulesVersion).toBe(RULES_VERSION);
    expect(fresh.compliance.some((f) => f.category === "pesticide_claim")).toBe(true);
    expect(fresh.risk?.level).not.toBe("low");
  });
});
