# Rule-layer evaluation (rules v2)

Labelled phrases: 64 (45 risky, 19 acceptable). Run `npm run eval` to reproduce; no API calls.

- **Risky phrases caught:** 45/45 (100%)
- **False alarms on acceptable phrases:** 0/19 (0%)

| Category | Caught | Missed | Extra flags | Recall | Precision |
| --- | --- | --- | --- | --- | --- |
| certification_claim | 4 | 0 | 0 | 100% | 100% |
| contact_info | 2 | 0 | 0 | 100% | 100% |
| environmental_claim | 3 | 0 | 1 | 100% | 75% |
| medical_claim | 15 | 0 | 0 | 100% | 100% |
| pesticide_claim | 6 | 0 | 0 | 100% | 100% |
| promotional | 3 | 0 | 0 | 100% | 100% |
| safety_claim | 4 | 0 | 0 | 100% | 100% |
| trademark | 6 | 0 | 0 | 100% | 100% |
| unverifiable_claim | 5 | 0 | 0 | 100% | 100% |

## Missed by the rule layer (left to the AI review)

- none

## False alarms

- none

The rule layer is deliberately conservative and is only the first of two layers: the AI review (step 5) looks for implied claims and paraphrases the word lists cannot match.

**Read with care:** these phrases were written by the developers alongside the rules, so the numbers are optimistic. The set is a regression guard (a rule change that breaks a known case fails `npm run eval`), not an independent accuracy claim. Next step: add held-out phrases from real takedown notices.
