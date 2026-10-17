import type { CheckedClaim, SavedCheck } from "@openlabel/check";
import type { Label, Section, Sentence, SentenceId, SetId } from "@openlabel/label";
import { describe, expect, it } from "vitest";
import { blastRadius } from "../src/blast.ts";
import { diffLabels } from "../src/diff.ts";

function sentence(section: string, paragraph: number, text: string): Sentence {
  return { id: `${section}:${paragraph}.1` as SentenceId, section, paragraph, kind: "prose", text };
}

function section(number: string, sentences: Sentence[]): Section {
  return { number, title: number, loinc: "", subsections: [], sentences };
}

function label(version: number, sections: Section[]): Label {
  return { setId: "595f437d-2729-40bb-9c62-c8ece1f82780" as SetId, version, title: "Lorvexa", effectiveDate: "", sections };
}

const loading = sentence("2.2", 1, "Give 600 mg once, then 300 mg every other week.");
const ages = sentence("1.7", 1, "Lorvexa is indicated for adults with chronic urticaria.");

const before = label(1, [
  section("1.7", [ages]),
  section("2.2", [loading]),
  section("5.2", [sentence("5.2", 1, "Conjunctivitis occurred more often.")]),
]);
const after = label(2, [
  section("1.7", [sentence("1.7", 1, "Lorvexa is indicated for patients aged 2 and older with chronic urticaria.")]),
  section("2.2", [sentence("2.2", 1, "Give 400 mg once, then 300 mg every other week.")]),
  section("5.2", [sentence("5.2", 1, "Conjunctivitis occurred more often."), sentence("5.2", 2, "Blindness has been reported.")]),
]);

function claim(id: string, kind: CheckedClaim["kind"], evidenceText: Sentence[]): CheckedClaim {
  return { id, text: id, kind, query: "", start: 0, end: 1, verdict: "supported", reason: "", evidence: evidenceText.map((s) => s.id), evidenceText };
}

function saved(claims: CheckedClaim[], hasIsi: boolean): SavedCheck {
  return {
    piece: hasIsi ? "Ask about Lorvexa. Important Safety Information: ..." : "Ask about Lorvexa.",
    label: { setId: before.setId, version: 1, title: "Lorvexa" },
    claims,
    findings: [],
    exitCode: 0,
    checkedAt: "2026-01-01T00:00:00Z",
  };
}

describe("blastRadius", () => {
  const diff = diffLabels(before, after);

  it("flags a claim whose cited sentence changed, with the new wording", () => {
    const impacts = blastRadius(saved([claim("dose", "dosing", [loading])], false), diff);
    expect(impacts).toHaveLength(1);
    const [impact] = impacts;
    expect(impact?.kind).toBe("cited-sentence-changed");
    if (impact?.kind === "cited-sentence-changed" && impact.change.kind === "changed") {
      expect(impact.change.after.text).toMatch(/400 mg/);
    }
  });

  it("flags an indication claim when the indication changed", () => {
    const impacts = blastRadius(saved([claim("who", "indication", [])], false), diff);
    expect(impacts.map((i) => i.kind)).toEqual(["indication-changed"]);
  });

  it("leaves an indication claim alone when it cites a different indication", () => {
    const eczema = sentence("1.1", 1, "Lorvexa is indicated for atopic dermatitis.");
    expect(blastRadius(saved([claim("ad", "indication", [eczema])], false), diff)).toEqual([]);
  });

  it("does not double count a claim already caught through its citation", () => {
    const impacts = blastRadius(saved([claim("who", "indication", [ages])], false), diff);
    expect(impacts.map((i) => i.kind)).toEqual(["cited-sentence-changed"]);
  });

  it("marks safety information outdated only on pieces that carry it", () => {
    expect(blastRadius(saved([], true), diff).map((i) => i.kind)).toEqual(["safety-information-outdated"]);
    expect(blastRadius(saved([], false), diff)).toEqual([]);
  });

  it("leaves a piece alone when nothing it relies on changed", () => {
    const unrelated = sentence("14.1", 1, "38% reached IGA 0 or 1.");
    expect(blastRadius(saved([claim("eff", "efficacy", [unrelated])], false), diff)).toEqual([]);
  });
});
