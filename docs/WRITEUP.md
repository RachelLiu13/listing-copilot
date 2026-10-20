# Listing Copilot: a compliance gatekeeper for cross-border sellers

**UCLA Agentic AI Capstone · Final project write-up**  
Live app: https://listing-copilot-nine.vercel.app · Code: https://github.com/RachelLiu13/listing-copilot

## 1. The problem

Hundreds of thousands of small sellers in China, Vietnam, Latin America and elsewhere sell on Amazon and TikTok Shop in markets whose language they do not write natively. A typical seller is one or two people running tens to hundreds of products. They know their products well, in their own language.

Writing the listing is no longer their hardest problem. Amazon now drafts listings for free, and tools such as Helium 10 add keyword data. The expensive problem is **getting the listing removed**. Marketplaces suppress listings for restricted claims: "antibacterial" makes a cutting board a pesticide under EPA rules, "relieves pain" makes a bracelet a medical device, "FDA approved" is false for almost every consumer product, and another brand's name is an infringement. The term lists are not public, the filters react to *combinations* of words ("vitamin C" near "treats"), and the removal notice arrives in English legal language. A seller who does not read English well cannot tell which word caused the problem, so they guess, relist, and get flagged again.

**Target user:** a small seller who writes product notes in their own language, sells on Amazon US/UK/DE/JP or TikTok Shop US, and has no native-speaking copywriter or compliance reviewer.

**Why AI is the right tool.** The job needs four skills at once: understanding notes in any language (often mixed), writing natural copy in the market's language, planning the phrases shoppers really type, and judging whether a sentence *implies* a regulated claim. Translation APIs and templates cover one skill at most, and word lists alone cannot tell "relieves joint pain" from "soft cushioning". A language model can make these judgments, inside a pipeline where code enforces the parts that must be exact.

## 2. The solution

Listing Copilot is positioned as **the compliance gatekeeper for sellers who don't write English natively**. The seller writes notes in any language and gets back:

1. **A listing in the marketplace's own language:** title, five bullets, description and backend search terms, within the marketplace's limits.
2. **A takedown-risk score from 0 to 100**, with the reasons behind it.
3. **Every risky phrase explained in the seller's language**, with a safe rewrite, plus a back-translation of exactly what the listing claims.
4. **Claims tied to evidence.** A certification or safety claim stays only if the seller holds a matching document; otherwise it is rewritten as a plain material fact. Nothing the seller did not say is claimed; invented details are flagged as *unconfirmed*.

Around this core sit the tools a small seller needs to stay listed:

- **Audit** an existing live listing, with the risk before and after the smallest possible fix.
- **Takedown help:** paste the removal notice and get the cause, the fixes and an English appeal draft.
- **Bulk CSV:** up to 50 products in one run.
- **Evidence library:** test reports and certificates the seller holds.
- **Free re-check** of every saved listing when the rules are updated.

**The whole interface is available in five languages:** English, Simplified Chinese, Vietnamese, Spanish and Japanese. It is chosen from the browser and can be switched before signing in, and the AI's explanations follow the chosen language. A seller who cannot read English can use the product from sign-up to export.

**How it compares:**

| | Amazon's free AI | Helium 10 / Jungle Scout | Listing Copilot |
| --- | --- | --- | --- |
| Input and interface in the seller's language | partly | no | yes |
| Marketplaces | Amazon only | Amazon only | Amazon US/UK/DE/JP and TikTok Shop |
| Risk score before publishing | no | no | 0-100, with reasons |
| Category rules and phrase combinations | no | no | 8 rule packs |
| Explanation and back-translation | no | no | yes |
| Takedown notice → cause, fix, appeal | no | no | yes |

**Business model:**

- 3 free credits at sign-up.
- $4.99 for 20 credits, or $9.99/month for unlimited use (Pro), paid through Stripe Checkout (test mode).
- One credit covers one listing, audit or appeal.
- A listing costs about $0.08 in model calls and takes about 40 seconds, so the pack price leaves a healthy margin.

## 3. Architecture

```
Browser ──> Next.js on Vercel (pages + API routes + middleware)
              ├── AI pipeline (src/lib/ai) ──> Claude API (structured JSON outputs)
              │                             └─> marketplace search-box suggestions
              ├── Supabase: Auth, Postgres with Row Level Security
              └── Stripe Checkout ──signed webhook──> credits / Pro plan
```

| Layer | Technology |
| --- | --- |
| Frontend | Next.js 15 App Router, React 19, Tailwind 4 |
| Backend | Next.js route handlers, streamed progress (newline-delimited JSON) |
| AI | Claude via the Anthropic SDK, JSON-schema structured outputs, zod validation |
| Domain rules | Plain TypeScript: marketplace limits, compliance rules, risk score (unit-tested, no I/O) |
| Auth and data | Supabase Auth; Postgres with Row Level Security |
| Payments | Stripe Checkout and a signature-verified webhook |
| Hosting | Vercel; a push to `main` deploys |

**The generation pipeline.** Each step has one job, its own schema and its own effort level:

1. **Extract:** notes (and an optional photo) become structured English facts and a product category. If the notes are too thin, the step returns 1–4 questions in the seller's language and **no credit is spent**.
2. **Keywords:** the facts plus up to 20 real phrases from the marketplace's search box become a keyword plan in the market's language. The main-image check runs in parallel.
3. **Write:** title, bullets, description and search terms. A certification can be stated only if a matching document is selected.
4. **Check limits:** length, forbidden characters, bullet count and search-term bytes are checked in code. The model gets one repair attempt, then code trims.
5. **Review:** three checks run in parallel:

    - category rule packs (deterministic);
    - an AI review for implied claims, using each market's laws (FDA/EPA/FTC/CPSC in the US, ASA in the UK, UWG/HWG in Germany, the PMD Act in Japan);
    - a grounding check that marks any claim not supported by the facts.

    Then the risk score is computed in code, and one more call explains the review in the reader's language.

The audit, appeal and re-check flows reuse the same parts. For example, an audit runs extract → review → minimal fix → review again.

**Key design decisions**

- **Rules in code, judgment in the model.** Hard limits and the rule layer are deterministic, explainable and free; the model handles what rules cannot see. AI findings are kept only if they quote text that really appears in the listing.
- **The model never invents the number.** The risk score is computed from the findings (30 per high, 10 per medium, 7 per unconfirmed claim, +10 in regulated categories, capped at 100), so the same listing always gets the same score.
- **Money paths never trust the client.**

    - A credit is spent by an atomic SQL function only after step 1 succeeds, and refunded on any later failure.
    - Credits are added only by the Stripe webhook after signature verification, once per event id, so Stripe's retries are safe.
    - The browser cannot call these functions.
- **One type for every language.** The interface dictionaries share a TypeScript type, so a missing translation fails the build.

## 4. Handling errors and edge cases

| Situation | What happens |
| --- | --- |
| Notes too thin ("cup") | Questions in the seller's language; free |
| Model invents a spec ("waterproof") | Grounding marks it *unconfirmed*; one-click removal |
| Invalid or truncated JSON | Retried once; then a typed error, a clear message and a refund |
| Timeouts, rate limits, 5xx | SDK retries; then a message in the reader's language and a refund |
| Safety refusal | Server-side fallback model; a final refusal becomes a message and a refund |
| Prompt injection in the notes | Seller text is wrapped as data, instruction-like text is flagged, outputs are schema-bound, the model has no tools |
| Browser closes mid-run | The server finishes and saves; the listing appears on the dashboard |
| Abuse and cost | 4 generations per minute and 60 per day per user; 10 AI rewrites per listing; token usage logged per step |
| Rules change later | Every result stores its rules version; older listings get a free re-check with no model call |

## 5. Evaluation

- **Unit tests:** 43 tests run with a scripted fake model and no network. They cover the pipeline, the rules, the limit validator, billing events, CSV parsing and the five dictionaries.
- **Rule-layer evaluation:** `npm run eval` scores the rules on 64 labelled marketplace phrases, including traps such as "dog treats" and "perfect for camping". The result is **45/45 risky phrases caught and 0/19 false alarms.** These phrases were written alongside the rules, so the numbers are optimistic. The set works as a regression guard (the command fails if recall drops below 85% or false alarms exceed 15%), not as an independent benchmark.
- **End-to-end checks with the real APIs:**
    - Listings generated from Chinese, Vietnamese and Spanish notes.
    - A German listing, where the AI noticed that a US FDA report does not cover EU food-contact rules.
    - An audit that took a risky cutting-board listing from risk 100 to 0.
    - An appeal answered in Vietnamese.
    - A Stripe test payment that added credits once, even when the event was re-sent.
    - The same journeys checked on the live site in other interface languages.

## 6. Lessons learned

1. **The real problem was not the one I started with.** I began with "write better English listings". Competitor research showed writing is now free; the unmet need is *not losing the listing*. Repositioning around compliance shaped every later feature.
2. **Split the work between code and the model deliberately.** The first version asked one prompt to do everything; it was slow, hard to debug and sometimes ignored limits. Narrow steps with schemas made failures attributable, made progress visible, and let the cheap first step stop a run before charging.
3. **Hallucination needs a structural answer.** Telling the model "don't invent facts" was not enough. A separate grounding step, quoting checks on AI findings, and evidence-gated claims made invented content visible instead of hidden.
4. **Localization is part of the product, not a polish step.** Explanations in the seller's language were planned early, but buttons and error messages were English until late. A user who cannot read "Sign in" cannot reach the feature that explains their risk.
5. **Be honest about evaluation.** A 100% score on phrases I wrote myself proves little. Labelling it as a regression guard, and naming a held-out set as the next step, is more useful than a flattering number.

## 7. Next steps

- Publish directly through the Amazon SP-API and TikTok Shop API, and re-scan live listings on a schedule.
- A held-out evaluation set built from real takedown notices, and an evaluation of the AI review layer with measured precision.
- Real search-volume data alongside the search-box suggestions.
- Upload and verify the evidence files themselves (storage, expiry dates).
- More marketplaces (Amazon FR/IT/ES, Walmart) with their own rule packs, a billing portal for Pro, and team accounts.
