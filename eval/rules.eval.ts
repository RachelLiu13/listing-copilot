/**
 * Measures the rule layer on eval/cases.json and writes eval/RESULTS.md.
 * Run with: npm run eval   (no API calls, no cost)
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "vitest";
import { RULES_VERSION, scanField, type CategoryPack } from "@/lib/listing/compliance-rules";

type Case = { pack: CategoryPack; text: string; expect: string[] };
const here = path.dirname(new URL(import.meta.url).pathname);
const { cases } = JSON.parse(readFileSync(path.join(here, "cases.json"), "utf8")) as { cases: Case[] };

test("rule layer on the labelled set", () => {
  const perCat = new Map<string, { tp: number; fn: number; fp: number }>();
  const bump = (c: string, k: "tp" | "fn" | "fp") => {
    const v = perCat.get(c) ?? { tp: 0, fn: 0, fp: 0 };
    v[k]++;
    perCat.set(c, v);
  };
  let risky = 0, caught = 0, clean = 0, falseAlarms = 0;
  const misses: string[] = [];
  const alarms: string[] = [];

  for (const c of cases) {
    const got = new Set<string>(scanField("text", c.text, { pack: c.pack }).map((f) => f.category));
    const want = new Set(c.expect);
    for (const w of want) bump(w, got.has(w) ? "tp" : "fn");
    for (const g of got) if (!want.has(g)) bump(g, "fp");
    if (want.size) {
      risky++;
      if ([...want].some((w) => got.has(w))) caught++;
      else misses.push(`${c.text}  (expected ${c.expect.join(", ")})`);
    } else {
      clean++;
      if (got.size) {
        falseAlarms++;
        alarms.push(`${c.text}  (flagged ${[...got].join(", ")})`);
      }
    }
  }

  const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "n/a");
  const rows = [...perCat.entries()].sort().map(([c, v]) => `| ${c} | ${v.tp} | ${v.fn} | ${v.fp} | ${pct(v.tp, v.tp + v.fn)} | ${pct(v.tp, v.tp + v.fp)} |`);
  const report = [
    `# Rule-layer evaluation (rules v${RULES_VERSION})`,
    "",
    `Labelled phrases: ${cases.length} (${risky} risky, ${clean} acceptable). Run \`npm run eval\` to reproduce; no API calls.`,
    "",
    `- **Risky phrases caught:** ${caught}/${risky} (${pct(caught, risky)})`,
    `- **False alarms on acceptable phrases:** ${falseAlarms}/${clean} (${pct(falseAlarms, clean)})`,
    "",
    "| Category | Caught | Missed | Extra flags | Recall | Precision |",
    "| --- | --- | --- | --- | --- | --- |",
    ...rows,
    "",
    "## Missed by the rule layer (left to the AI review)",
    "",
    ...(misses.length ? misses.map((m) => `- ${m}`) : ["- none"]),
    "",
    "## False alarms",
    "",
    ...(alarms.length ? alarms.map((a) => `- ${a}`) : ["- none"]),
    "",
    "The rule layer is deliberately conservative and is only the first of two layers: the AI review (step 5) looks for implied claims and paraphrases the word lists cannot match.",
    "",
    "**Read with care:** these phrases were written by the developers alongside the rules, so the numbers are optimistic. The set is a regression guard (a rule change that breaks a known case fails `npm run eval`), not an independent accuracy claim. Next step: add held-out phrases from real takedown notices.",
    "",
  ].join("\n");
  writeFileSync(path.join(here, "RESULTS.md"), report);
  console.log(report);

  // Guard against regressions; the numbers themselves are reported above.
  expect(caught / risky).toBeGreaterThanOrEqual(0.85);
  expect(falseAlarms / clean).toBeLessThanOrEqual(0.15);
});
