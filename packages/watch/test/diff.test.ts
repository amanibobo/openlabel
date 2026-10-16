import type { Label, Section, SentenceId, SetId } from "@openlabel/label";
import { describe, expect, it } from "vitest";
import { categoryOf, diffLabels } from "../src/diff.ts";

function section(number: string, title: string, texts: string[]): Section {
  return {
    number,
    title,
    loinc: "",
    subsections: [],
    sentences: texts.map((text, i) => ({
      id: `${number}:${i + 1}.1` as SentenceId,
      section: number,
      paragraph: i + 1,
      kind: "prose",
      text,
    })),
  };
}

function label(version: number, sections: Section[]): Label {
  return { setId: "595f437d-2729-40bb-9c62-c8ece1f82780" as SetId, version, title: "Lorvexa", effectiveDate: "2026-01-01", sections };
}

const before = label(1, [
  section("2.2", "Recommended dosage", ["Give 600 mg once.", "Then 300 mg every other week.", "Do not freeze."]),
  section("5.3", "Infections", ["Treat infections before starting."]),
]);

const after = label(2, [
  section("2.2", "Recommended dosage", ["Give 400 mg once.", "Then 300 mg every other week.", "Do not freeze."]),
  section("5.3", "Infections", ["Treat infections before starting."]),
  section("5.4", "Keratitis", ["Keratitis occurred more often with Lorvexa."]),
]);

describe("diffLabels", () => {
  const diff = diffLabels(before, after);

  it("reports only the sections that changed", () => {
    expect(diff.sections.map((s) => s.section)).toEqual(["2.2", "5.4"]);
  });

  it("pairs an edited sentence instead of listing a removal and an addition", () => {
    const [dosing] = diff.sections;
    expect(dosing?.category).toBe("dosing");
    expect(dosing?.changes).toEqual([
      { kind: "changed", before: expect.objectContaining({ text: "Give 600 mg once." }), after: expect.objectContaining({ text: "Give 400 mg once." }) },
    ]);
  });

  it("marks a brand new section as an added warning", () => {
    const warning = diff.sections[1];
    expect(warning).toMatchObject({ status: "added", category: "warning", title: "Keratitis" });
    expect(warning?.changes).toEqual([{ kind: "added", after: expect.objectContaining({ text: "Keratitis occurred more often with Lorvexa." }) }]);
  });

  it("keeps unrelated removals and additions separate", () => {
    const a = label(1, [section("6.1", "Adverse reactions", ["Headache was common."])]);
    const b = label(2, [section("6.1", "Adverse reactions", ["Rash led to discontinuation in 2%."])]);
    expect(diffLabels(a, b).sections[0]?.changes.map((c) => c.kind)).toEqual(["removed", "added"]);
  });

  it("finds nothing between identical labels", () => {
    expect(diffLabels(before, before).sections).toEqual([]);
  });
});

describe("categoryOf", () => {
  it("maps label sections to the kind of change they carry", () => {
    expect(["boxed", "1.7", "2", "4", "5.10", "6.2", "14.1", "12.1"].map(categoryOf)).toEqual([
      "boxed-warning",
      "indication",
      "dosing",
      "contraindication",
      "warning",
      "adverse-reactions",
      "clinical-studies",
      "other",
    ]);
  });
});
