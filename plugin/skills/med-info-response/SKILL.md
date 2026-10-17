---
name: med-info-response
description: Draft a medical information response letter to an unsolicited question from a healthcare provider, grounded in the FDA label. Use when someone needs a reply to an HCP's question about dosing, safety, efficacy, special populations, or a use the label does not cover.
---

# Medical information response

A response to an unsolicited question is scientific exchange, not promotion. It answers what was asked, cites its sources, and stays neutral. When the question is about a use the label does not include, the response says so plainly rather than avoiding the question.

## Steps

1. Restate the question in one sentence, the way the requester asked it. If it is ambiguous, say what you took it to mean.
2. Run `openlabel search <drug> "<question>"` and read the results. Search again with label vocabulary (indication names, endpoint names, section topics like "pregnancy" or "hepatic impairment") until you have every relevant sentence or are sure the label is silent.
3. Decide whether the question is about an approved use: the indication, population and dose in section 1 and 2.

## Letter

- **Opening:** "Thank you for your question about [drug] and [topic]."
- **Off-label notice**, only when the question concerns a use, population or dose the label does not include: "[Drug] is not approved for [use]. This response is provided in reply to your unsolicited request and is not intended to promote any unapproved use." Then give only what the label says that bears on the question, such as the populations that were studied.
- **Answer:** what the label says, section by section, each statement followed by its citation, such as (§8.1). Quote numbers exactly: percentages, doses, ages, time points. Say when the label does not address part of the question.
- **Close:** refer to the full prescribing information, and offer to forward the question to the medical information team for published literature beyond the label.

Write in plain clinical prose. No adjectives that sell ("powerful", "proven", "convenient"), no comparisons with other drugs the label does not make, no recommendations about what the requester should prescribe. Every factual sentence carries a citation; if you cannot cite it, leave it out.
