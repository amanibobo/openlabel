import type { SkillResult } from "@openlabel/skills";
import { describe, expect, it } from "vitest";
import { formatSkills } from "../src/format-skills.ts";

const results: SkillResult[] = [
  { skill: "label-diff", passed: 4, total: 4, cases: [] },
  {
    skill: "hcp-sms",
    passed: 2,
    total: 3,
    cases: [
      { id: "ok", passed: true, checks: [], reply: "" },
      {
        id: "variants-under-limit",
        passed: false,
        reply: "",
        checks: [
          { check: { type: "called", tool: "openlabel_check" }, passed: true },
          { check: { type: "max-length", lines: "x", max: 160 }, passed: false, note: "1 line(s) over 160" },
        ],
      },
      { id: "crashed", passed: false, checks: [], reply: "", error: "rate limited" },
    ],
  },
];

describe("formatSkills", () => {
  const lines = formatSkills(results, { color: false }).split("\n");

  it("prints a pass rate per skill", () => {
    expect(lines[0]).toBe("  label-diff     100%   4/4 cases");
    expect(lines[1]).toBe("  hcp-sms       66.7%   2/3 cases");
  });

  it("names each failed case and only its failing checks", () => {
    expect(lines.slice(2, 5)).toEqual([
      "    ✗ variants-under-limit",
      "        lines matching /x/ stay within 160 characters (1 line(s) over 160)",
      "    ✗ crashed: rate limited",
    ]);
    expect(lines.at(-1)).toBe("  6 of 7 cases passed");
  });
});
