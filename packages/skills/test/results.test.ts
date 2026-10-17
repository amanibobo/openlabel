import { describe, expect, it } from "vitest";
import { summarize } from "../src/results.ts";

describe("summarize", () => {
  it("keeps pass or fail per case and drops replies and checks", () => {
    const file = summarize(
      [{ skill: "hcp-sms", passed: 1, total: 2, cases: [
        { id: "a", passed: true, checks: [], reply: "long reply" },
        { id: "b", passed: false, checks: [], reply: "", error: "rate limited" },
      ] }],
      "claude-opus-5-5",
      new Date("2026-10-16T23:16:00Z"),
    );
    expect(file).toEqual({
      ranAt: "2026-10-16T23:16:00.000Z",
      model: "claude-opus-5-5",
      skills: [{ skill: "hcp-sms", passed: 1, total: 2, cases: [{ id: "a", passed: true }, { id: "b", passed: false }] }],
    });
  });
});
