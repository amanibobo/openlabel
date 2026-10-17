import type { CheckedClaim } from "@openlabel/check";
import type { SentenceId } from "@openlabel/label";
import { describe, expect, it } from "vitest";
import { claimList, detail, footer, initialState, move, wrap, type Line } from "../src/ui/view.ts";

const text = (line: Line) => line.map((s) => s.text).join("");

const sentence = { id: "14.1:12.1" as SentenceId, section: "14.1", paragraph: 12, kind: "table-row" as const, text: "IGA 0 or 1 | 38% | 10%", context: "Table 18: Efficacy Results" };

const claims: CheckedClaim[] = [
  { id: "c1", text: "38% of adults achieved clear skin", kind: "efficacy", query: "", start: 0, end: 1, verdict: "supported", evidence: [sentence.id], evidenceText: [sentence], reason: "Table 18 reports 38% versus 10% on placebo." },
  { id: "c2", text: "Now approved for chronic hives in children as young as 2", kind: "indication", query: "", start: 2, end: 3, verdict: "off-label", evidence: [], evidenceText: [], reason: "Only chronic spontaneous urticaria." },
];

const done = { ...initialState("email.html", "dupixent"), phase: "done" as const, total: 2, claims, exitCode: 2 };

describe("check view", () => {
  it("marks the selected claim and clips long claims to the pane", () => {
    const lines = claimList({ ...done, selected: 1 }, 40).map(text);
    expect(lines[0]).toBe("  ✓ supported   “38% of adults achieved…");
    expect(lines[1]).toMatch(/^▍ ✗ off-label   “Now approved/);
    expect(lines.every((l) => l.length <= 40)).toBe(true);
  });

  it("shows the selected claim's reason and cited label sentence with its table", () => {
    const lines = detail(done, 60).map(text);
    expect(lines[0]).toBe("✓ supported  efficacy");
    expect(lines).toContain("Table 18 reports 38% versus 10% on placebo.");
    expect(lines).toContain("§14.1 ¶12");
    expect(lines).toContain("Table 18: Efficacy Results");
    expect(detail({ ...done, selected: 1 }, 60).map(text)).toContain("No label sentence cited.");
  });

  it("reports progress while running and the summary when done", () => {
    const judging = { ...done, phase: "judging" as const, claims: claims.slice(0, 1), exitCode: null };
    expect(text(footer(judging, "⠋"))).toBe("⠋ judging claims 1/2   ↑↓ move   q quit");
    expect(text(footer(done, "⠋"))).toBe("1 supported · 1 off-label · exit 2   ↑↓ move   q quit");
  });

  it("keeps the selection inside the list", () => {
    expect(move(done, -1).selected).toBe(0);
    expect(move(move(move(done, 1), 1), 1).selected).toBe(1);
    expect(move(initialState("f", "l"), 1).selected).toBe(0);
  });

  it("wraps text to the pane width", () => {
    expect(wrap("one two three four", 9, "#fff").map(text)).toEqual(["one two", "three", "four"]);
  });
});
