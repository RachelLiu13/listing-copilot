/**
 * Layer 1 of the compliance check: a deterministic lexicon.
 *
 * Words that are always risky on an English-language marketplace listing are
 * matched here, in code, so the result is stable, explainable and free. On top
 * of the base list, each product category loads its own rule pack (cosmetics,
 * supplements, children's products...), including phrase-combination rules:
 * marketplaces flag "vitamin C" + "treats" together even though each word is
 * fine alone. Layer 2 (an LLM review in the pipeline) looks for what a word list
 * cannot catch: implied claims, context and paraphrases.
 *
 * Bump RULES_VERSION whenever a rule changes: listings checked under an older
 * version are offered a free re-check.
 */
export const RULES_VERSION = 2;
export type Severity = "high" | "medium";
export type ComplianceCategory =
  | "medical_claim"
  | "pesticide_claim"
  | "unverifiable_claim"
  | "promotional"
  | "trademark"
  | "environmental_claim"
  | "safety_claim"
  | "certification_claim"
  | "contact_info";

export const CATEGORY_PACKS = ["general", "food_contact", "cosmetics", "supplements", "children", "electronics", "cleaning", "pet"] as const;
export type CategoryPack = (typeof CATEGORY_PACKS)[number];

/** Packs where a takedown is most likely and most costly (regulated goods). */
const REGULATED: CategoryPack[] = ["cosmetics", "supplements", "children", "cleaning", "pet"];

export interface ComplianceFinding {
  field: string;
  text: string;
  category: ComplianceCategory;
  severity: Severity;
  reason: string;
  suggestion: string;
  source: "rule" | "ai";
  /** Set when the seller holds a document that may back the claim. */
  evidence?: string;
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
    // "#1" starts with a symbol, so it cannot sit behind a word boundary like the rest.
    pattern: new RegExp(`${w(["best[- ]sell(?:er|ing)", "number one", "best", "top[- ]rated", "highest quality", "guaranteed", "100% (?:safe|guaranteed)"]).source}|(?<![\\w#])#\\s?1\\b`, "gi"),
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

/** Extra rules per product category, added on top of the base list. */
const PACKS: Record<CategoryPack, Rule[]> = {
  general: [],
  food_contact: [
    {
      category: "certification_claim",
      severity: "medium",
      pattern: w(["food[- ]safe", "FDA[- ]compliant", "LFGB", "lead[- ]free", "cadmium[- ]free"]),
      reason: "Food-contact safety claims need a test report (e.g. FDA 21 CFR or LFGB) the marketplace can request.",
      suggestion: "Keep only with a lab report; otherwise name the material (e.g. 'food-grade silicone').",
    },
  ],
  cosmetics: [
    {
      category: "medical_claim",
      severity: "high",
      pattern: w(["anti[- ]?aging", "removes? wrinkles", "skin whitening", "whitening", "SPF ?\\d+", "sun ?screen", "treats? acne", "acne", "hair (?:re)?growth", "regrow"]),
      reason: "These are drug claims for cosmetics (FDA OTC rules for sunscreen and acne; whitening and hair growth are drug claims).",
      suggestion: "Describe the feel and use instead ('lightweight moisturizer for daily use').",
    },
    {
      category: "safety_claim",
      severity: "medium",
      pattern: w(["hypoallergenic", "dermatologically tested", "paraben[- ]free", "all[- ]natural", "100% natural", "organic"]),
      reason: "Hypoallergenic, natural and organic claims need test results or certification (USDA Organic for 'organic').",
      suggestion: "Keep only with the certificate; otherwise list the actual ingredients.",
    },
  ],
  supplements: [
    {
      category: "medical_claim",
      severity: "high",
      pattern: w(["weight loss", "burns? fat", "fat burner", "boosts? (?:your )?immun\\w*", "detox\\w*", "lowers? (?:blood pressure|cholesterol|blood sugar)", "anti[- ]?cancer"]),
      reason: "Supplements may not claim to treat, prevent or reduce disease risk (FDA/FTC); weight-loss and immunity claims are top takedown triggers.",
      suggestion: "Use a structure/function statement with the FDA disclaimer, or describe the ingredients only.",
    },
  ],
  children: [
    {
      category: "safety_claim",
      severity: "high",
      pattern: w(["non[- ]toxic", "baby[- ]safe", "safe for (?:babies|kids|children|toddlers|infants)", "child[- ]safe", "chok\\w* hazard[- ]free"]),
      reason: "Safety claims on children's products require CPSC-accepted lab testing and a Children's Product Certificate (CPC).",
      suggestion: "Remove the safety claim, or keep it only with a CPC and test report on file.",
    },
    {
      category: "certification_claim",
      severity: "medium",
      pattern: w(["CPC certified", "ASTM F963", "CPSIA compliant", "CE certified"]),
      reason: "Certification claims must match a certificate you can upload when asked.",
      suggestion: "Keep only if you hold the exact certificate.",
    },
  ],
  electronics: [
    {
      category: "certification_claim",
      severity: "medium",
      pattern: w(["FCC certified", "FCC approved", "UL listed", "UL certified", "ETL listed", "CE certified", "RoHS"]),
      reason: "Certification marks need a certificate or FCC ID; uncertified claims can get a listing removed.",
      suggestion: "Keep only with the certificate or FCC ID; otherwise remove.",
    },
    {
      category: "unverifiable_claim",
      severity: "medium",
      pattern: w(["waterproof", "military[- ]grade", "fireproof", "explosion[- ]proof"]),
      reason: "Waterproof and toughness claims need a rating (e.g. IP67) or test standard behind them.",
      suggestion: "State the rating ('IP67 water resistant') if you have it; otherwise remove.",
    },
  ],
  cleaning: [
    {
      category: "pesticide_claim",
      severity: "high",
      pattern: w(["kills 99\\.9", "99\\.9% of (?:germs|bacteria)", "germ[- ]free", "eliminates (?:germs|bacteria|viruses|mold|mildew)", "deodori[sz]es? by killing"]),
      reason: "Germ- and mold-killing claims make a cleaning product a pesticide that needs EPA registration.",
      suggestion: "Describe the cleaning action ('lifts grease and grime') instead.",
    },
  ],
  pet: [
    {
      category: "pesticide_claim",
      severity: "high",
      pattern: w(["fleas?", "ticks?", "repels? (?:insects|mosquitoes|bugs)", "insect repellent", "mosquito repellent", "kills (?:fleas|ticks|lice)"]),
      reason: "Flea, tick and insect claims are pesticide claims (EPA/FIFRA) and are gated on Amazon.",
      suggestion: "Remove the pest claim unless the product is EPA-registered.",
    },
  ],
};

/** Words that are fine alone but flagged together (within a few words). */
const COMBO_SUBJECTS = "vitamin\\s?[a-z0-9]*|herb\\w*|essential oils?|CBD|collagen|probiotics?|magnesium|turmeric|copper|tourmaline|infrared|magnetic|negative ions?|silver ions?";
const COMBO_CLAIMS = "treats?|cures?|heals?|prevents?|relieves?|reduces? (?:pain|inflammation|anxiety|stress)|boosts? immun\\w*|fights? (?:infection|bacteria|viruses)|kills?";
const COMBO_RE = new RegExp(`\\b(?:${COMBO_SUBJECTS})\\b(?:\\W+\\w+){0,6}?\\W+(?:${COMBO_CLAIMS})\\b|\\b(?:${COMBO_CLAIMS})\\b(?:\\W+\\w+){0,6}?\\W+(?:${COMBO_SUBJECTS})\\b`, "gi");

export interface ScanOptions {
  pack?: CategoryPack;
  /** Documents the seller holds (names and reference numbers). */
  evidence?: string[];
  /** Non-English listing: the English word lists do not apply; only brand names and contact details are matched. */
  brandsOnly?: boolean;
}

export function scanField(field: string, text: string, opts: ScanOptions = {}): ComplianceFinding[] {
  const out: ComplianceFinding[] = [];
  const rules = opts.brandsOnly
    ? RULES.filter((r) => r.category === "contact_info")
    : [...RULES, ...(opts.pack ? PACKS[opts.pack] : [])];
  for (const rule of rules) {
    for (const m of text.matchAll(rule.pattern)) {
      out.push({ field, text: m[0], category: rule.category, severity: rule.severity, reason: rule.reason, suggestion: rule.suggestion, source: "rule" });
    }
  }
  for (const m of opts.brandsOnly ? [] : text.matchAll(COMBO_RE)) {
    out.push({
      field,
      text: m[0],
      category: "medical_claim",
      severity: "high",
      reason: "An ingredient or material next to a health effect reads as a drug claim; marketplace filters flag the combination even when each word is fine alone.",
      suggestion: "Separate them: describe the ingredient, and drop the health effect.",
      source: "rule",
    });
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
  return withEvidence(dedupe(out), opts.evidence);
}

export function scanListing(fields: Record<string, string | string[]>, opts: ScanOptions = {}): ComplianceFinding[] {
  const out: ComplianceFinding[] = [];
  for (const [name, value] of Object.entries(fields)) {
    const parts = Array.isArray(value) ? value : [value];
    parts.forEach((text, i) => out.push(...scanField(Array.isArray(value) ? `${name}[${i}]` : name, text, opts)));
  }
  return dedupe(out);
}

const EVIDENCE_TOPICS: { finding: RegExp; doc: RegExp }[] = [
  { finding: /FDA|food[- ]?(?:grade|safe)|LFGB|lead|cadmium/i, doc: /FDA|21 ?CFR|LFGB|food[- ]?contact|food[- ]?grade/i },
  { finding: /BPA/i, doc: /BPA|FDA|LFGB|food[- ]?contact/i },
  { finding: /EPA|bacteri|microb|germ|disinfect|sanitiz|mold|flea|tick|repel/i, doc: /EPA/i },
  { finding: /CPC|CPSIA|ASTM|safe for|baby|child|toxic/i, doc: /CPC|CPSIA|ASTM|CPSC/i },
  { finding: /FCC|UL|ETL|CE|RoHS|waterproof|IP\d/i, doc: /FCC|UL|ETL|CE|RoHS|IP\d/i },
  { finding: /organic/i, doc: /USDA|organic|GOTS|EU ?organic/i },
  { finding: /clinic|dermatolog|hypoallergenic|tested/i, doc: /clinical|dermatolog|study|test report|lab/i },
  { finding: /eco|biodegrad|compost|sustainab|recycl/i, doc: /FSC|BPI|compost|recycl|GRS|OEKO/i },
];

/**
 * A claim the seller can document is not removed: it is downgraded to medium
 * ("keep the document ready"), and the matching document is named.
 */
function withEvidence(findings: ComplianceFinding[], evidence: string[] = []): ComplianceFinding[] {
  if (!evidence.length) return findings;
  return findings.map((f) => {
    if (f.category === "promotional" || f.category === "contact_info" || f.category === "trademark") return f;
    const topic = EVIDENCE_TOPICS.find((t) => t.finding.test(f.text));
    const doc = topic && evidence.find((e) => topic.doc.test(e));
    if (!doc) return f;
    return {
      ...f,
      severity: "medium" as const,
      evidence: doc,
      reason: `${f.reason} You hold "${doc}", so the claim can stay if the document covers this exact product.`,
      suggestion: "Keep the document ready to upload if the marketplace asks for it.",
    };
  });
}

// ---------------------------------------------------------------- risk score

export interface RiskScore {
  score: number;
  level: "low" | "medium" | "high";
  drivers: string[];
}

/**
 * How likely the listing is to be suppressed or flagged, 0-100. Deterministic
 * and explainable: every point comes from a listed driver.
 */
export function riskScore(findings: ComplianceFinding[], unsupportedClaims: number, pack: CategoryPack = "general"): RiskScore {
  const high = findings.filter((f) => f.severity === "high");
  const medium = findings.filter((f) => f.severity === "medium");
  const drivers: string[] = [];
  let score = 0;
  if (high.length) {
    score += Math.min(70, high.length * 30);
    drivers.push(`${high.length} high-risk phrase${high.length > 1 ? "s" : ""} (likely removal)`);
  }
  if (medium.length) {
    score += Math.min(30, medium.length * 10);
    drivers.push(`${medium.length} claim${medium.length > 1 ? "s" : ""} that need proof`);
  }
  if (unsupportedClaims) {
    score += Math.min(20, unsupportedClaims * 7);
    drivers.push(`${unsupportedClaims} statement${unsupportedClaims > 1 ? "s" : ""} you never confirmed`);
  }
  if (REGULATED.includes(pack) && (high.length || medium.length)) {
    score += 10;
    drivers.push(`regulated category (${pack.replace("_", " ")}): reviewed more strictly`);
  }
  score = Math.min(100, score);
  return { score, level: score >= 50 ? "high" : score >= 20 ? "medium" : "low", drivers };
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
