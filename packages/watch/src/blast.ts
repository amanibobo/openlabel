import { carriesSafetyInformation, type CheckedClaim, type SavedCheck } from "@openlabel/check";
import type { Sentence } from "@openlabel/label";
import { normalize, type LabelDiff, type SectionChange, type SentenceChange } from "./diff.ts";

export type Impact =
  | { kind: "cited-sentence-changed"; claim: CheckedClaim; cited: Sentence; change: SentenceChange; section: SectionChange }
  | { kind: "indication-changed"; claim: CheckedClaim; section: SectionChange }
  | { kind: "safety-information-outdated"; section: SectionChange };

const SAFETY_CATEGORIES = new Set(["boxed-warning", "contraindication", "warning"]);

export function blastRadius(saved: SavedCheck, diff: LabelDiff): Impact[] {
  const changedBefore = new Map<string, { change: SentenceChange; section: SectionChange }>();
  for (const section of diff.sections) {
    for (const change of section.changes) {
      if (change.kind !== "added") changedBefore.set(normalize(change.before.text), { change, section });
    }
  }

  const impacts: Impact[] = [];
  const touched = new Set<string>();
  for (const claim of saved.claims) {
    for (const cited of claim.evidenceText) {
      const hit = changedBefore.get(normalize(cited.text));
      if (!hit) continue;
      impacts.push({ kind: "cited-sentence-changed", claim, cited, ...hit });
      touched.add(claim.id);
    }
  }

  // An indication claim is at risk when it rests on the changed indication, or when it
  // rests on nothing and the change might now cover or exclude it.
  for (const section of diff.sections.filter((s) => s.category === "indication")) {
    for (const claim of saved.claims) {
      if (claim.kind !== "indication" || touched.has(claim.id)) continue;
      const cited = new Set(claim.evidenceText.map((s) => s.section));
      if (cited.size === 0 || cited.has(section.section)) impacts.push({ kind: "indication-changed", claim, section });
    }
  }

  if (carriesSafetyInformation(saved.piece)) {
    for (const section of diff.sections.filter((s) => SAFETY_CATEGORIES.has(s.category))) {
      impacts.push({ kind: "safety-information-outdated", section });
    }
  }
  return impacts;
}
