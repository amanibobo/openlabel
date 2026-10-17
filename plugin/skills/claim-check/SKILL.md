---
name: claim-check
description: Check promotional or HCP-facing copy against the drug's FDA label and explain each verdict. Use when someone asks whether a piece, email, SMS, slide or claim is on-label, supported, overstated, or ready for MLR review.
---

# Claim check

Run `openlabel check <file> --label <drug> --json` on the piece. If the copy was pasted rather than saved, write it to a temporary file first. Pass `--rules <pack.yaml>` when the user names a rule pack or the piece is a text message (`examples/pulse-sms.yaml` in the openlabel repo).

The report lists every claim with a verdict, the label sentences it was judged against, and a one-line reason, plus rule findings and an exit code:

- `supported`: the label states it and the claim is no stronger.
- `overstated`: the label supports a weaker version.
- `off-label`: a use, population or dose the label does not include.
- `unsupported`: nothing in the label addresses it.

## Reply

Lead with the outcome in one sentence: ready for review, or how many claims need work.

Then go claim by claim, worst first. For each one that is not supported:

1. Quote the claim exactly.
2. Give the verdict and the citation, such as §14.1 ¶12.
3. Quote the label sentence the verdict rests on.
4. Offer one rewrite that the cited sentence supports. Keep the writer's tone; change only what the label requires.

List supported claims last, one line each with their citation. Report rule findings, such as missing safety information, as their own items.

Never call a claim supported unless the report does. If the report cites no sentence, say the label could not be matched and suggest checking the claim by hand. Do not soften verdicts: an MLR reviewer will read this.
