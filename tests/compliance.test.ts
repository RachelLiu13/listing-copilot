import { describe, expect, it } from "vitest";
import { scanField, scanListing } from "@/lib/listing/compliance-rules";

const cats = (text: string) => scanField("title", text).map((f) => `${f.category}:${f.severity}`);

describe("compliance lexicon", () => {
  it("flags regulated health and germ claims as high risk", () => {
    expect(cats("FDA approved bottle")).toContain("medical_claim:high");
    expect(cats("Antibacterial cutting board")).toContain("pesticide_claim:high");
    expect(cats("Cures back pain fast")).toContain("medical_claim:high");
  });

  it("flags superlatives, promotions and contact details", () => {
    expect(cats("Best Seller water cup")).toContain("unverifiable_claim:medium");
    expect(cats("Free shipping today")).toContain("promotional:high");
    expect(cats("Visit www.example.com")).toContain("contact_info:high");
  });

  it("treats a brand name as high risk, but a compatibility statement as medium", () => {
    expect(cats("Stanley style tumbler")).toContain("trademark:high");
    expect(cats("Case compatible with iPhone 16")).toContain("trademark:medium");
  });

  it("does not flag ordinary product words", () => {
    expect(scanField("title", "Dog Treats Pouch, perfect for wholesale buyers, ideal for walks")).toEqual([]);
  });

  it("names the field, including the bullet index", () => {
    const f = scanListing({ title: "Cup", bullets: ["Soft grip", "BPA-free lid"] });
    expect(f).toHaveLength(1);
    expect(f[0]).toMatchObject({ field: "bullets[1]", category: "environmental_claim" });
  });
});

describe("category packs, phrase combinations, evidence and risk", () => {
  it("adds category rules only for that category", async () => {
    const { scanField } = await import("@/lib/listing/compliance-rules");
    expect(scanField("title", "Anti-aging face cream", { pack: "cosmetics" }).map((f) => f.category)).toContain("medical_claim");
    expect(scanField("title", "Anti-aging face cream", { pack: "general" })).toEqual([]);
    expect(scanField("title", "Safe for babies, soft silicone", { pack: "children" })[0]).toMatchObject({ category: "safety_claim", severity: "high" });
    expect(scanField("title", "Dog collar keeps fleas away", { pack: "pet" })[0]).toMatchObject({ category: "pesticide_claim" });
  });

  it("flags an ingredient next to a health effect, but not either word alone", async () => {
    const { scanField } = await import("@/lib/listing/compliance-rules");
    expect(scanField("description", "Vitamin C serum that treats dark spots")).toHaveLength(1);
    expect(scanField("description", "Copper bracelet relieves arthritis")[0].category).toBe("medical_claim");
    expect(scanField("description", "Vitamin C serum in a glass bottle")).toEqual([]);
  });

  it("downgrades a claim the seller can document and names the document", async () => {
    const { scanField } = await import("@/lib/listing/compliance-rules");
    const plain = scanField("title", "FDA approved food container");
    const backed = scanField("title", "FDA approved food container", { evidence: ["FDA 21 CFR 177 food-contact test report #A123"] });
    expect(plain[0].severity).toBe("high");
    expect(backed[0]).toMatchObject({ severity: "medium", evidence: "FDA 21 CFR 177 food-contact test report #A123" });
  });

  it("only matches brands and contact details on non-English listings", async () => {
    const { scanField } = await import("@/lib/listing/compliance-rules");
    expect(scanField("title", "Der beste Becher für iPhone www.shop.de", { brandsOnly: true }).map((f) => f.category).sort()).toEqual(["contact_info", "trademark"]);
  });

  it("scores risk from the findings, with a regulated-category bump", async () => {
    const { riskScore } = await import("@/lib/listing/compliance-rules");
    const high = { field: "title", text: "x", category: "medical_claim" as const, severity: "high" as const, reason: "", suggestion: "", source: "rule" as const };
    const medium = { ...high, severity: "medium" as const };
    expect(riskScore([], 0)).toEqual({ score: 0, level: "low", drivers: [] });
    expect(riskScore([medium], 0).level).toBe("low");
    expect(riskScore([high], 0).level).toBe("medium");
    expect(riskScore([high, high], 0).level).toBe("high");
    expect(riskScore([high], 0, "supplements").score).toBe(riskScore([high], 0).score + 10);
    expect(riskScore(Array(10).fill(high), 9, "children").score).toBe(100);
  });
});
