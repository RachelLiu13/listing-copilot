import { describe, expect, it } from "vitest";
import { listingCsv } from "@/lib/csv";
import { toOutputSchema } from "@/lib/ai/claude";
import { ProductFactsSchema } from "@/lib/listing/types";

describe("CSV export", () => {
  it("escapes quotes, commas and newlines and starts with a BOM", () => {
    const csv = listingCsv([{ productName: "水杯", platform: "amazon_us", copy: { title: 'Cup, "Big"', bullets: ["a\nb"], description: "d", searchTerms: ["x", "y"] } }]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain('"Cup, ""Big"""');
    expect(csv).toContain('"a\nb"');
    expect(csv.trim().split("\r\n")).toHaveLength(2);
  });
});

describe("structured output schema", () => {
  it("is strict: every property required, no extra properties", () => {
    const s = toOutputSchema(ProductFactsSchema) as { required: string[]; properties: Record<string, unknown>; additionalProperties: boolean; $schema?: string };
    expect(s.additionalProperties).toBe(false);
    expect(s.required.sort()).toEqual(Object.keys(s.properties).sort());
    expect(s.$schema).toBeUndefined();
  });
});
