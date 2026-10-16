import type { Report } from "@openlabel/check";
import type { SentenceId, SetId } from "@openlabel/label";
import { describe, expect, it } from "vitest";
import { formatReport } from "../src/format.ts";

const sentence = { id: "14.1:12.1" as SentenceId, section: "14.1", paragraph: 12, kind: "table-row" as const, text: "IGA 0 or 1 | 38%" };

const report: Report = {
  piece: "",
  label: { setId: "595f437d-2729-40bb-9c62-c8ece1f82780" as SetId, version: 60, title: "Dupixent (dupilumab)" },
  claims: [
    {
      id: "c1", text: "38% of adults achieved clear skin", kind: "efficacy", query: "", start: 0, end: 1,
      verdict: "supported", evidence: [sentence.id], evidenceText: [sentence], reason: "Table 18 reports 38%.",
    },
    {
      id: "c2", text: "Get back to the life you love.", kind: "quality-of-life", query: "", start: 2, end: 3,
      verdict: "overstated", evidence: [], evidenceText: [], reason: "Only questionnaire scores were measured.",
    },
  ],
  findings: [{ rule: "isi.present", severity: "violation", message: "No Important Safety Information on the piece." }],
  exitCode: 2,
};

describe("formatReport", () => {
  const text = formatReport(report, { color: false });

  it("shows each verdict with its claim, citation and reason", () => {
    expect(text).toContain("✓ supported    “38% of adults achieved clear skin”  §14.1 ¶12");
    expect(text).toContain("Table 18 reports 38%.");
    expect(text).toContain("~ overstated   “Get back to the life you love.”");
  });

  it("lists rule findings and a summary with the exit code", () => {
    expect(text).toContain("✗ isi.present  No Important Safety Information on the piece.");
    expect(text.split("\n").at(-1)?.trim()).toBe("1 supported · 1 overstated · 1 rule finding · exit 2");
  });

  it("adds color only when asked", () => {
    expect(text).not.toContain("\x1b[");
    expect(formatReport(report, { color: true })).toContain("\x1b[32m");
  });
});
