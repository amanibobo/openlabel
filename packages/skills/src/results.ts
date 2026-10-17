import type { SkillResult } from "./evaluate.ts";

// What a full eval run publishes: pass or fail per case, without the replies.
export type ResultsFile = {
  ranAt: string;
  model: string;
  skills: { skill: string; passed: number; total: number; cases: { id: string; passed: boolean }[] }[];
};

export const RESULTS_FILE = "results.json";

export function summarize(results: SkillResult[], model: string, ranAt: Date): ResultsFile {
  return {
    ranAt: ranAt.toISOString(),
    model,
    skills: results.map((r) => ({
      skill: r.skill,
      passed: r.passed,
      total: r.total,
      cases: r.cases.map((c) => ({ id: c.id, passed: c.passed })),
    })),
  };
}
