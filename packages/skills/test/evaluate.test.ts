import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { evaluateSkill, listSkills } from "../src/evaluate.ts";

function skills(): string {
  const dir = mkdtempSync(join(tmpdir(), "openlabel-skills-"));
  mkdirSync(join(dir, "echo"));
  writeFileSync(join(dir, "echo", "SKILL.md"), "---\nname: echo\n---\nSay it back.");
  writeFileSync(
    join(dir, "echo", "evals.yaml"),
    `cases:
  - id: hello
    prompt: hello
    checks:
      - type: contains
        text: hello
  - id: cite
    prompt: cite
    checks:
      - type: called
        tool: openlabel_search
  - id: broken
    prompt: crash
    checks:
      - type: contains
        text: x
`,
  );
  return dir;
}

const judge = async () => true;

describe("evaluateSkill", () => {
  it("scores each case and counts a crashed case as failed", async () => {
    const dir = skills();
    expect(await listSkills(dir)).toEqual(["echo"]);
    const result = await evaluateSkill(dir, "echo", {
      judge,
      run: async (_skill, prompt) => {
        if (prompt === "crash") throw new Error("rate limited");
        return { reply: prompt, toolCalls: [] };
      },
    });
    expect(result.cases.map((c) => [c.id, c.passed])).toEqual([["hello", true], ["cite", false], ["broken", false]]);
    expect(result.cases[2]?.error).toBe("rate limited");
    expect([result.passed, result.total]).toEqual([1, 3]);
  });

  it("can run a single case", async () => {
    const result = await evaluateSkill(skills(), "echo", { judge, only: "hello", run: async (_s, p) => ({ reply: p, toolCalls: [] }) });
    expect(result.cases.map((c) => c.id)).toEqual(["hello"]);
  });
});
