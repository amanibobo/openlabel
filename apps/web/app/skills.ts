import { readFileSync } from "node:fs";
import path from "node:path";
import { parse } from "yaml";
import { skillSummaries } from "./content";

const SKILLS_DIR = path.join(process.cwd(), "..", "..", "plugin", "skills");

type Results = {
  ranAt: string;
  skills: { skill: string; passed: number; total: number; cases: { id: string; passed: boolean }[] }[];
};

export type SkillRow = {
  name: string;
  summary: string;
  passed: number;
  total: number;
  cases: { id: string; passed: boolean; prompt: string }[];
};

function firstLine(prompt: string): string {
  const line = prompt.trim().split("\n")[0]!.trim();
  return line.length > 110 ? `${line.slice(0, 109)}…` : line;
}

// Read at build time: the last saved eval run and each skill's case prompts.
export function skillRows(): { ranAt: string; rows: SkillRow[] } {
  const results = JSON.parse(readFileSync(path.join(SKILLS_DIR, "results.json"), "utf8")) as Results;
  const rows = results.skills.map((s) => {
    const suite = parse(readFileSync(path.join(SKILLS_DIR, s.skill, "evals.yaml"), "utf8")) as { cases: { id: string; prompt: string }[] };
    const prompts = new Map(suite.cases.map((c) => [c.id, firstLine(c.prompt)]));
    return {
      name: s.skill,
      summary: skillSummaries[s.skill] ?? "",
      passed: s.passed,
      total: s.total,
      cases: s.cases.map((c) => ({ ...c, prompt: prompts.get(c.id) ?? "" })),
    };
  });
  return { ranAt: results.ranAt, rows };
}
