import { describe, expect, it } from "vitest";
import { PLATFORMS } from "@/lib/listing/platforms";
import { byteLength, copyIssues, enforceLimits, normalizeSearchTerms, titleIssues, truncateAtWord } from "@/lib/listing/validate";

const amazon = PLATFORMS.amazon_us;

describe("platform limits", () => {
  it("truncates at a word boundary without trailing punctuation", () => {
    expect(truncateAtWord("Silicone Cup, Foldable, Travel", 24)).toBe("Silicone Cup, Foldable");
    expect(truncateAtWord("short", 24)).toBe("short");
  });

  it("finds forbidden characters and repeated words in titles", () => {
    const issues = titleIssues("Cup! Cup Cup Cup for camping", amazon).map((i) => i.problem);
    expect(issues.some((p) => p.includes("!"))).toBe(true);
    expect(issues.some((p) => p.includes("cup"))).toBe(true);
  });

  it("cleans search terms: no title words, no brand, no duplicates, within the byte limit", () => {
    const terms = normalizeSearchTerms(["Camping Mug", "collapsible cup", "ACME travel", "camping mug", "hiking bottle"], "Collapsible Silicone Cup", 249, "Acme");
    expect(terms).toEqual(["camping mug", "travel", "hiking bottle"]);
    const many = normalizeSearchTerms(Array.from({ length: 80 }, (_, i) => `word${i} phrase${i}`), "x", 249);
    expect(byteLength(many.join(" "))).toBeLessThanOrEqual(249);
  });

  it("enforceLimits always returns copy that passes the checks", () => {
    const long = {
      title: "Cup! " + "Portable Foldable Silicone Travel Water ".repeat(10),
      bullets: Array.from({ length: 7 }, () => "x ".repeat(300)),
      description: "d ".repeat(1500),
      searchTerms: ["a b c"],
    };
    const fixed = enforceLimits(long, amazon);
    expect(fixed.title.length).toBeLessThanOrEqual(amazon.titleMax);
    expect(fixed.title).not.toContain("!");
    expect(copyIssues({ ...fixed, bullets: fixed.bullets.slice(0, 5) }, amazon).filter((i) => i.field !== "title")).toEqual([]);
  });
});
