import { describe, expect, it } from "vitest";
import { complete, extract, NeedsMoreInfo, rewriteSection } from "@/lib/ai/pipeline";
import type { JsonRequest, JsonResult, LLM } from "@/lib/ai/llm";
import { AIError } from "@/lib/ai/llm";
import { ListingInputSchema, type ProductFacts } from "@/lib/listing/types";

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
  return { llm, calls };
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

const keywords = { primary: [{ phrase: "collapsible cup", why: "common term" }], secondary: ["camping cup"], avoid: [] };

const goodCopy = {
  title: "Collapsible Silicone Water Cup, 350 ml Foldable Travel Cup with Hanging Hook for Camping",
  bullets: ["Folds to 2 cm", "Hanging hook", "350 ml capacity", "Food-grade silicone", "Best for camping trips"],
  description: "A collapsible cup made of food-grade silicone. It is waterproof and folds flat.",
  search_terms: ["camping mug", "hiking cup"],
};

describe("step 1: extract", () => {
  it("asks follow-up questions in the seller's own language when the notes are too thin", async () => {
    const { llm, calls } = fakeLLM({ extract: { ...facts, sufficient: false, input_language: "Spanish", missing_questions: ["¿De qué material es?", "¿Qué capacidad tiene?"] } });
    const thin = ListingInputSchema.parse({ platform: "amazon_us", productName: "taza" });
    const err = await extract(thin, llm).catch((e) => e);
    expect(err).toBeInstanceOf(NeedsMoreInfo);
    expect(err.questions).toEqual(["¿De qué material es?", "¿Qué capacidad tiene?"]);
    expect(calls).toEqual(["extract"]);
  });

  it("falls back to an English question if the model gives none", async () => {
    const { llm } = fakeLLM({ extract: { ...facts, sufficient: false, missing_questions: [] } });
    const err = await extract(input, llm).catch((e) => e);
    expect(err.questions[0]).toMatch(/material/);
  });

  it("returns the model's questions when it judges the input insufficient", async () => {
    const { llm } = fakeLLM({ extract: { ...facts, sufficient: false, missing_questions: ["容量多大？"] } });
    const err = await extract(input, llm).catch((e) => e);
    expect(err).toBeInstanceOf(NeedsMoreInfo);
    expect(err.questions).toEqual(["容量多大？"]);
  });
});

describe("steps 2-5: complete", () => {
  it("repairs a draft that breaks limits, then reviews it", async () => {
    const tooLong = { ...goodCopy, title: "Cup! " + "Collapsible Silicone ".repeat(20) };
    const { llm, calls } = fakeLLM({
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
    });
    const ex = await extract(input, llm);
    const result = await complete(input, ex, llm);

    expect(calls).toEqual(["extract", "keywords", "write", "repair", "compliance", "grounding"]);
    expect(result.copy.title).toBe(goodCopy.title);
    expect(result.fixesApplied.length).toBeGreaterThan(0);
    // Rule layer catches the superlative in a bullet; AI layer adds "waterproof"; the invented quote is gone.
    expect(result.compliance.map((f) => `${f.source}:${f.text}`)).toEqual(expect.arrayContaining(["rule:Best", "ai:waterproof"]));
    expect(result.compliance.some((f) => f.text === "kills germs")).toBe(false);
    expect(result.unsupportedClaims).toHaveLength(1);
    expect(result.usage.map((u) => u.step)).toContain("repair");
    // Search terms never repeat title words.
    expect(result.copy.searchTerms.join(" ")).not.toMatch(/\bcup\b/);
  });

  it("skips the repair call when the draft is already within limits", async () => {
    const { llm, calls } = fakeLLM({ extract: facts, keywords, write: goodCopy, compliance: { findings: [] }, grounding: { unsupported: [] } });
    const ex = await extract(input, llm);
    await complete(input, ex, llm);
    expect(calls).not.toContain("repair");
  });

  it("lets model errors propagate so the route can refund the credit", async () => {
    const { llm } = fakeLLM({
      extract: facts,
      keywords: () => {
        throw new AIError("rate_limited", "busy", "keywords");
      },
    });
    const ex = await extract(input, llm);
    await expect(complete(input, ex, llm)).rejects.toMatchObject({ kind: "rate_limited" });
  });
});

describe("rewriteSection", () => {
  it("replaces one section and re-checks it", async () => {
    const { llm } = fakeLLM({ extract: facts, keywords, write: goodCopy, compliance: { findings: [] }, grounding: { unsupported: [] } });
    const ex = await extract(input, llm);
    const current = await complete(input, ex, llm);
    const { llm: llm2 } = fakeLLM({ rewrite_bullets: { bullets: ["Folds to 2 cm", "Hook", "350 ml", "Silicone", "Great for camping"] } });
    const out = await rewriteSection("bullets", current, "drop the superlative", llm2);
    expect(out.copy.bullets[4]).toBe("Great for camping");
    expect(out.copy.title).toBe(current.copy.title);
    expect(out.compliance.some((f) => f.text === "Best")).toBe(false);
  });
});
