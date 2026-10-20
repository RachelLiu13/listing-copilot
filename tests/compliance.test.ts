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
