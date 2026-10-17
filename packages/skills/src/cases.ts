import { parse as parseYaml } from "yaml";
import { z } from "zod";

const Check = z.discriminatedUnion("type", [
  z.object({ type: z.literal("contains"), text: z.string() }),
  z.object({ type: z.literal("not-contains"), text: z.string() }),
  z.object({ type: z.literal("matches"), pattern: z.string() }),
  z.object({ type: z.literal("called"), tool: z.string() }),
  // Every line matching `lines` must be at most `max` characters.
  z.object({ type: z.literal("max-length"), lines: z.string(), max: z.number().int().positive() }),
  // A yes/no question for a model grader, for what text matching cannot decide.
  z.object({ type: z.literal("judge"), question: z.string() }),
]);

const Case = z.object({
  id: z.string(),
  prompt: z.string(),
  checks: z.array(Check).min(1),
});

const Suite = z.object({ cases: z.array(Case).min(1) });

export type Check = z.infer<typeof Check>;
export type EvalCase = z.infer<typeof Case>;

export function loadCases(yamlText: string): EvalCase[] {
  return Suite.parse(parseYaml(yamlText)).cases;
}

export type Transcript = { reply: string; toolCalls: string[] };

export type CheckResult = { check: Check; passed: boolean; note?: string };

export type Judge = (question: string, transcript: Transcript, prompt: string) => Promise<boolean>;

export async function grade(evalCase: EvalCase, transcript: Transcript, judge: Judge): Promise<CheckResult[]> {
  const reply = transcript.reply;
  const lower = reply.toLowerCase();
  return Promise.all(
    evalCase.checks.map(async (check): Promise<CheckResult> => {
      switch (check.type) {
        case "contains":
          return { check, passed: lower.includes(check.text.toLowerCase()) };
        case "not-contains":
          return { check, passed: !lower.includes(check.text.toLowerCase()) };
        case "matches":
          return { check, passed: new RegExp(check.pattern, "im").test(reply) };
        case "called":
          return { check, passed: transcript.toolCalls.includes(check.tool) };
        case "max-length": {
          const pattern = new RegExp(check.lines, "i");
          const lines = reply.split("\n").filter((line) => pattern.test(line));
          const long = lines.filter((line) => line.length > check.max);
          return lines.length === 0
            ? { check, passed: false, note: "no line matched" }
            : { check, passed: long.length === 0, ...(long.length && { note: `${long.length} line(s) over ${check.max}` }) };
        }
        case "judge":
          // A grader that can't answer fails its own check and keeps the reply and the other checks.
          return judge(check.question, transcript, evalCase.prompt).then(
            (passed) => ({ check, passed }),
            (error: Error) => ({ check, passed: false, note: error.message }),
          );
      }
    }),
  );
}
