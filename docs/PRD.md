# PRD: Listing Copilot

## Problem

Small cross-border sellers on Amazon US and TikTok Shop US (one or two people running tens to hundreds of SKUs, in China, Vietnam, Korea, Latin America and elsewhere) write English listings with machine translation. The result:

- **Reads as translated, not written.** Stiff titles and bullets convert poorly with US shoppers.
- **Misses how Americans search.** "收纳盒" becomes "receiving box"; shoppers search "storage bins with lids".
- **Gets listings removed.** A stray "FDA approved", "antibacterial", "best seller" or another brand's name can get a listing suppressed or an account flagged.
- **Costs money to fix.** A US copywriter costs tens of dollars per listing; agencies cost more.

## Competition and positioning

| Competitor | What it does | Gap we take |
| --- | --- | --- |
| Amazon's built-in generative AI (free) | Drafts a listing from an image or URL; "Enhance My Listing" rewrites existing ones | Amazon only; no risk explanation; the seller still owns the takedown risk |
| Helium 10, Jungle Scout ($49-359/month) | Keyword-data-driven listing builders | Expensive, English-only, no policy-risk review |
| SellerSprite and similar Chinese tools | AI listing drafts, keyword and brand-infringement checks | One language; no restricted-claim review or appeal help |

Sellers' most expensive problem is not writing: it is suppression for restricted claims (pesticide, drug, safety), where Amazon's term lists are not public and filters react to word *combinations*. **Positioning: the compliance gatekeeper for sellers who don't write English natively**, explaining every risk in their own language.

## Target user

A seller who knows the product in their own language, lists on Amazon US or TikTok Shop US, and has no in-house native English copywriter or compliance reviewer.

## Why AI

The job needs four skills at once: understanding product notes in any language, writing idiomatic US marketing copy, planning search phrases, and spotting risky claims, including implied ones. Templates and translation APIs cover one of these at most; rules alone cannot judge "helps relieve joint pain" vs "soft cushioning". An LLM can, inside a pipeline where code enforces the hard limits.

## MVP scope

| In | Out (next steps) |
| --- | --- |
| Email/password sign-up (Google optional) | Publishing to marketplaces via API |
| Input in any language + optional photo (main-image check) | Real search-volume data |
| Amazon US/UK/DE/JP and TikTok Shop US, written in each market's language | Publishing via marketplace APIs |
| Title, 5 bullets, description, backend search terms; real search-box phrases as keyword signals | A+ content, image editing |
| Category rule packs, phrase-combination rules, AI review, 0-100 risk score | Legal advice |
| Explanations and back-translation in the seller's language | Interface translation |
| Evidence library: claims kept only with a document | Uploading and verifying the files |
| Audit and fix a live listing; takedown/appeal assistant; bulk CSV; free re-check after rule updates | Scheduled re-scans, team accounts |
| 3 free credits; $4.99 for 20; $9.99/month unlimited | Billing portal, invoices |

## Core user journey

1. Sign up → 3 free credits.
2. New listing: pick marketplace, fill product notes in any language, optional photo.
3. Watch five steps run. If the notes are too thin, answer 1-4 questions (free).
4. Review the listing: risky phrases highlighted with reason and rewrite; unconfirmed claims marked.
5. Fix with AI, rewrite a section, or edit by hand; every change is re-checked.
6. Copy or export CSV.
7. After 3 listings: Stripe Checkout (test card 4242…), credits or Pro appear on the dashboard.

## Errors and edge cases

| Case | Behaviour |
| --- | --- |
| Input too thin ("杯子", "taza") | Step 1 asks 1-4 questions in the seller's own language; no credit spent |
| Model invents a spec | Grounding step marks it *unconfirmed*; one-click removal |
| Title over limit, forbidden characters, too many bullets | One model repair, then code trims; seller sees what was fixed |
| Other brands' names | Lexicon flags (compatibility statements as medium); AI review catches others |
| Claude timeout, 429, 5xx | SDK retries; then a friendly message and the credit is refunded |
| Invalid or truncated JSON | Retried once with more room; then a typed error and refund |
| Safety refusal | Server-side fallback model; final refusal → message + refund |
| Prompt injection in notes | Treated as data; seller is warned; outputs schema-constrained |
| Out of credits | Checked before any model call; link to pricing |
| Double-clicks, scripts | Rate limit per user; rewrite cap per listing |
| Stripe retries the webhook | Event id applied once |
| Browser closes mid-run | Server finishes and saves; listing appears on the dashboard |

## Success metrics

- Share of listings with zero high-risk findings after one fix round.
- Time from sign-up to first exported listing (target: under 5 minutes).
- Free → paid conversion; cost per listing (tokens are recorded per step).
