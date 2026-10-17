import type { Sentence, SentenceId, SetId } from "@openlabel/label";
import type { LabelDiff } from "@openlabel/watch";
import { describe, expect, it } from "vitest";
import { formatDiff } from "../src/format-diff.ts";

const s = (text: string): Sentence => ({ id: "1.7:1.1" as SentenceId, section: "1.7", paragraph: 1, kind: "prose", text });

const diff: LabelDiff = {
  setId: "595f437d-2729-40bb-9c62-c8ece1f82780" as SetId,
  title: "Dupixent (dupilumab)",
  from: { version: 53, effectiveDate: "2026-02-23" },
  to: { version: 60, effectiveDate: "2026-04-22" },
  sections: [
    {
      section: "1.7", title: "Chronic Spontaneous Urticaria", category: "indication", status: "changed",
      changes: [
        { kind: "changed", before: s("Aged 12 years and older."), after: s("Aged 2 years and older.") },
        { kind: "added", after: s("A new sentence.") },
      ],
    },
  ],
};

describe("formatDiff", () => {
  it("prints each changed sentence as removed and added lines under its section", () => {
    expect(formatDiff(diff, { color: false }).split("\n")).toEqual([
      "Dupixent (dupilumab) · v53 (2026-02-23) to v60 (2026-04-22)",
      "",
      "  §1.7 Chronic Spontaneous Urticaria · indication, changed",
      "    - Aged 12 years and older.",
      "    + Aged 2 years and older.",
      "    + A new sentence.",
    ]);
  });

  it("says so when nothing changed", () => {
    expect(formatDiff({ ...diff, sections: [] }, { color: false })).toContain("no changes to the prescribing information");
  });
});
