---
name: fair-balance
description: Judge whether a promotional draft gives risk information prominence comparable to its benefit claims, and draft the missing risk language from the FDA label. Use when someone asks about fair balance, safety information, ISI, or whether a piece downplays risks.
---

# Fair balance

FDA expects promotion to present risks with prominence comparable to benefits: similar placement, similar emphasis, and enough of the label's risks that a reader is not misled. Judge that against the label, not memory.

## Steps

1. Run `openlabel check <file> --label <drug> --json` to get the piece's benefit claims and whether it carries safety information.
2. Find the risks the piece must carry. Run `openlabel search <drug> "<topic>"` for each: the boxed warning (if the label has one), contraindications, warnings and precautions, and the most common adverse reactions. Search more than once with different wording if the first results miss.
3. Compare. For each benefit claim, note where it sits (headline, body, footnote) and how large or emphasized it is. For each required risk, note whether the piece mentions it, and where.

## Reply

Give a verdict first: balanced, unbalanced, or missing safety information entirely.

Then list each gap as one line: the risk the label requires, its citation, and what the piece does instead (omits it, buries it in a footnote, mentions it once below three benefit claims). Point out minimizing language, such as "rare", "mild" or "well tolerated", when the label does not use those words.

Close with suggested risk language: plain sentences built only from the label sentences you cited, each with its citation, short enough to sit next to the benefit claims they balance.

Do not invent risks, frequencies or wording the label lacks. If the label has no boxed warning, do not ask for one.
