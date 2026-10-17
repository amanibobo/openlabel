import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { mapLimit } from "@openlabel/util";
import { grade, loadCases, type CheckResult, type Judge, type Transcript } from "./cases.ts";

export type CaseResult = { id: string; passed: boolean; checks: CheckResult[]; reply: string; error?: string };

export type SkillResult = { skill: string; cases: CaseResult[]; passed: number; total: number };

export type RunSkill = (skill: string, prompt: string) => Promise<Transcript>;

export async function listSkills(skillsDir: string): Promise<string[]> {
  const entries = await readdir(skillsDir, { withFileTypes: true });
  return entries.filter((e) => e.isDirectory()).map((e) => e.name).sort();
}

export async function evaluateSkill(
  skillsDir: string,
  name: string,
  deps: { run: RunSkill; judge: Judge; concurrency?: number; only?: string },
): Promise<SkillResult> {
  const dir = join(skillsDir, name);
  const skill = await readFile(join(dir, "SKILL.md"), "utf8");
  const cases = loadCases(await readFile(join(dir, "evals.yaml"), "utf8")).filter((c) => !deps.only || c.id === deps.only);

  const results = await mapLimit(cases, deps.concurrency ?? 3, async (evalCase): Promise<CaseResult> => {
    try {
      const transcript = await deps.run(skill, evalCase.prompt);
      const checks = await grade(evalCase, transcript, deps.judge);
      return { id: evalCase.id, passed: checks.every((c) => c.passed), checks, reply: transcript.reply };
    } catch (error) {
      // A case that cannot run counts as a failure, so a broken harness cannot raise a score.
      return { id: evalCase.id, passed: false, checks: [], reply: "", error: (error as Error).message };
    }
  });

  return { skill: name, cases: results, passed: results.filter((r) => r.passed).length, total: results.length };
}
