import { describe, expect, it } from "vitest";
import { exitCodeFor, type Judgment } from "../src/types.ts";

const judged = (verdict: Judgment["verdict"]): Judgment => ({ verdict, evidence: [], reason: "" });

describe("exitCodeFor", () => {
  it("is 0 when every claim is supported and no rule fires", () => {
    expect(exitCodeFor([judged("supported")], [])).toBe(0);
  });

  it("is 1 for an overstated claim or a warning", () => {
    expect(exitCodeFor([judged("supported"), judged("overstated")], [])).toBe(1);
    expect(exitCodeFor([], [{ rule: "r", severity: "warning", message: "" }])).toBe(1);
  });

  it("is 2 when anything is off-label, unsupported or a violation, whatever else is present", () => {
    expect(exitCodeFor([judged("overstated"), judged("off-label")], [])).toBe(2);
    expect(exitCodeFor([judged("unsupported")], [])).toBe(2);
    expect(exitCodeFor([judged("supported")], [{ rule: "r", severity: "violation", message: "" }])).toBe(2);
  });
});
