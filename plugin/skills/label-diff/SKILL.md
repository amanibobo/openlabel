---
name: label-diff
description: Summarize what changed between two versions of a drug's FDA label and what it means for promotional and medical content. Use when someone asks what changed in a label, whether a label update affects their materials, or what a new indication, warning or dosing change says.
---

# Label diff

Run `openlabel diff <drug> --json` for the current label against the previous version, or add `--from <version>` and `--to <version>` when the user names versions. If the two versions have no changes to the prescribing information, say so and stop.

The diff groups changed sentences by section, each section tagged with a category: boxed-warning, indication, dosing, contraindication, warning, adverse-reactions, clinical-studies, or other.

## Reply

Open with one sentence naming the label, both versions and their dates, and the most consequential change.

Then cover changes in this order, skipping categories with nothing in them: boxed warning, indication, dosing, contraindications, warnings, adverse reactions, clinical studies. For each change:

1. Name the section, such as §1.7.
2. Say what changed in plain words: who is newly covered, what dose moved, what risk was added. Quote the old and new wording when the change is a number, an age, a population or a risk.
3. Say what it means for content: claims citing the old wording are now out of date, safety information on approved pieces needs the new warning, or a population is newly in or out of scope.

Group purely editorial changes (renamed headings, reworded cross-references) into one closing line instead of listing them.

If the user has approved pieces saved with `openlabel check --save`, end by suggesting `openlabel watch <folder>` to find the claims the change touches.

Never describe a change the diff does not show.
