import { describe, expect, it } from "vitest";
import { grade, loadCases, type EvalCase } from "../src/cases.ts";

const never = async () => {
  throw new Error("judge should not be called");
};

function run(checks: EvalCase["checks"], reply: string, toolCalls: string[] = []) {
  return grade({ id: "x", prompt: "p", checks }, { reply, toolCalls }, never);
}

describe("loadCases", () => {
  it("reads a suite and rejects an unknown check", () => {
    const yaml = "cases:\n  - id: a\n    prompt: hi\n    checks:\n      - type: contains\n        text: hello\n";
    expect(loadCases(yaml)).toEqual([{ id: "a", prompt: "hi", checks: [{ type: "contains", text: "hello" }] }]);
    expect(() => loadCases(yaml.replace("contains", "vibes"))).toThrow();
  });
});

describe("grade", () => {
  it("matches text without regard to case", async () => {
    const [has, lacks] = await run([{ type: "contains", text: "§14.1" }, { type: "not-contains", text: "BEST" }], "Cites §14.1, the best.");
    expect([has?.passed, lacks?.passed]).toEqual([true, false]);
  });

  it("checks tool calls and patterns", async () => {
    const results = await run([{ type: "called", tool: "openlabel_check" }, { type: "matches", pattern: "^verdict:" }], "intro\nVerdict: fine", ["openlabel_check"]);
    expect(results.map((r) => r.passed)).toEqual([true, true]);
  });

  it("fails a length check when any matching line is too long, or none match", async () => {
    const check = { type: "max-length" as const, lines: "dupixent", max: 20 };
    expect((await run([check], "DUPIXENT short\nother"))[0]?.passed).toBe(true);
    expect((await run([check], "DUPIXENT is far too long for this"))[0]).toMatchObject({ passed: false, note: "1 line(s) over 20" });
    expect((await run([check], "nothing here"))[0]).toMatchObject({ passed: false, note: "no line matched" });
  });

  it("asks the judge only for judge checks", async () => {
    const asked: string[] = [];
    const judge = async (question: string) => (asked.push(question), true);
    const results = await grade(
      { id: "x", prompt: "p", checks: [{ type: "judge", question: "Is it neutral?" }, { type: "contains", text: "a" }] },
      { reply: "a", toolCalls: [] },
      judge,
    );
    expect(asked).toEqual(["Is it neutral?"]);
    expect(results.every((r) => r.passed)).toBe(true);
  });
});
