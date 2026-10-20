/**
 * Layer 1 of the compliance check: a deterministic lexicon.
 *
 * Words that are always risky on a US marketplace listing are matched here,
 * in code, so the result is stable, explainable and free. Layer 2 (an LLM
 * review in the pipeline) only looks for what a word list cannot catch:
 * implied claims, context and paraphrases.
 */
export type Severity = "high" | "medium";
export type ComplianceCategory =
  | "medical_claim"
  | "pesticide_claim"
  | "unverifiable_claim"
  | "promotional"
  | "trademark"
  | "environmental_claim"
  | "contact_info";

export interface ComplianceFinding {
  field: string;
  text: string;
  category: ComplianceCategory;
  severity: Severity;
  reason: string;
  suggestion: string;
  source: "rule" | "ai";
}

interface Rule {
  category: ComplianceCategory;
  severity: Severity;
  pattern: RegExp;
  reason: string;
  suggestion: string;
}

const w = (words: string[]) => new RegExp(`\\b(?:${words.join("|")})\\b`, "gi");

const RULES: Rule[] = [
  {
    category: "medical_claim",
    severity: "high",
    // "treats" alone is left out on purpose: "dog treats" is a product, not a claim.
    pattern: w(["cures?", "treats? (?:\\w+ )?(?:pain|disease|acne|eczema|insomnia|anxiety|infections?|arthritis)", "heals?", "prevents? (?:disease|illness|infection|cancer)", "relieves? (?:pain|anxiety|arthritis)", "therapeutic", "medical[- ]grade", "anti[- ]inflammatory"]),
    reason: "Disease or treatment claims make a product a regulated drug or device; marketplaces remove listings that make them.",
    suggestion: "Describe the physical feature instead (e.g. 'soft memory foam supports your neck').",
  },
  {
    category: "medical_claim",
    severity: "high",
    pattern: /\bFDA[- ](?:approved|certified|registered|cleared)\b/gi,
    reason: "'FDA approved' is a regulated claim that needs proof; most consumer goods are not FDA approved.",
    suggestion: "Remove it, or say 'made with food-grade silicone' if that is documented.",
  },
  {
    category: "medical_claim",
    severity: "medium",
    pattern: w(["clinically (?:proven|tested)", "doctor (?:recommended|approved)", "dermatologist (?:recommended|tested)"]),
    reason: "Clinical or professional endorsement claims need substantiation the platform may ask for.",
    suggestion: "Remove unless you hold the study or endorsement documents.",
  },
  {
    category: "pesticide_claim",
    severity: "high",
    pattern: w(["anti[- ]?bacterial", "anti[- ]?microbial", "kills (?:germs|bacteria|viruses)", "disinfects?", "sanitiz(?:es|ing)", "anti[- ]?viral", "mold[- ]resistant"]),
    reason: "Germ-killing claims are pesticide claims under EPA rules; Amazon requires EPA registration to make them.",
    suggestion: "Use 'easy to clean' or 'dishwasher safe' instead.",
  },
  {
    category: "unverifiable_claim",
    severity: "medium",
    pattern: w(["best[- ]sell(?:er|ing)", "#\\s?1", "number one", "best", "top[- ]rated", "highest quality", "guaranteed", "100% (?:safe|guaranteed)"]),
    reason: "Superlatives and rankings cannot be verified and are not allowed in Amazon titles; they also read as hype.",
    suggestion: "Replace with a concrete fact (capacity, material, size, warranty length).",
  },
  {
    category: "promotional",
    severity: "high",
    pattern: w(["free shipping", "on sale", "sale", "discount", "limited time", "buy now", "cheapest", "deal", "% off"]),
    reason: "Prices, promotions and calls to action are not allowed in listing copy; promotions belong in the platform's deal tools.",
    suggestion: "Remove the promotional wording.",
  },
  {
    category: "environmental_claim",
    severity: "medium",
    pattern: w(["eco[- ]friendly", "biodegradable", "compostable", "non[- ]toxic", "BPA[- ]free", "chemical[- ]free", "sustainable"]),
    reason: "Environmental and safety claims need certification or test reports (FTC Green Guides).",
    suggestion: "Keep only if you have the certificate; otherwise state the material plainly.",
  },
  {
    category: "contact_info",
    severity: "high",
    pattern: /\b(?:https?:\/\/|www\.)\S+|\b[\w.+-]+@[\w-]+\.[\w.]+\b|\b(?:wechat|whatsapp|telegram)\b/gi,
    reason: "Links, emails and off-platform contact details are prohibited in listings.",
    suggestion: "Remove it.",
  },
];

/** Well-known marks sellers often borrow. Not exhaustive: layer 2 catches others. */
const BRANDS = [
  "Apple", "iPhone", "iPad", "AirPods", "MacBook", "Samsung", "Galaxy", "Nike", "Adidas", "Disney", "Marvel",
  "Pokemon", "Stanley", "YETI", "Hydro Flask", "Dyson", "LEGO", "Barbie", "Hello Kitty", "Lululemon", "Tupperware",
  "Ziploc", "Pyrex", "Crocs", "Nintendo", "PlayStation", "Xbox", "Kindle", "Owala", "Tesla", "Louis Vuitton", "Gucci", "Chanel",
];
const BRAND_RE = new RegExp(`\\b(?:${BRANDS.map((b) => b.replace(/ /g, "\\s+")).join("|")})\\b`, "gi");
const COMPAT_RE = /\b(?:compatible with|fits|for use with|designed for|works with)\s+$/i;

export function scanField(field: string, text: string): ComplianceFinding[] {
  const out: ComplianceFinding[] = [];
  for (const rule of RULES) {
    for (const m of text.matchAll(rule.pattern)) {
      out.push({ field, text: m[0], category: rule.category, severity: rule.severity, reason: rule.reason, suggestion: rule.suggestion, source: "rule" });
    }
  }
  for (const m of text.matchAll(BRAND_RE)) {
    const before = text.slice(Math.max(0, (m.index ?? 0) - 25), m.index ?? 0);
    const compat = COMPAT_RE.test(before);
    out.push({
      field,
      text: m[0],
      category: "trademark",
      severity: compat ? "medium" : "high",
      reason: compat
        ? "A compatibility statement can use another brand's name only if it is accurate and not in a way that implies endorsement."
        : "Using another company's brand name in your listing can get it removed for trademark infringement.",
      suggestion: compat ? "Keep only if compatibility is tested; never put it at the start of the title." : "Remove the brand name and describe the product generically.",
      source: "rule",
    });
  }
  return dedupe(out);
}

export function scanListing(fields: Record<string, string | string[]>): ComplianceFinding[] {
  const out: ComplianceFinding[] = [];
  for (const [name, value] of Object.entries(fields)) {
    const parts = Array.isArray(value) ? value : [value];
    parts.forEach((text, i) => out.push(...scanField(Array.isArray(value) ? `${name}[${i}]` : name, text)));
  }
  return dedupe(out);
}

export function dedupe(findings: ComplianceFinding[]): ComplianceFinding[] {
  const seen = new Set<string>();
  return findings.filter((f) => {
    const key = `${f.field}|${f.text.toLowerCase()}|${f.category}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
