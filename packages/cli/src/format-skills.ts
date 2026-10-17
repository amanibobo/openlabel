import type { Check, SkillResult } from "@openlabel/skills";

function describe(check: Check): string {
  switch (check.type) {
    case "contains":
      return `mentions "${check.text}"`;
    case "not-contains":
      return `avoids "${check.text}"`;
    case "matches":
      return `matches /${check.pattern}/`;
    case "called":
      return `calls ${check.tool}`;
    case "max-length":
      return `lines matching /${check.lines}/ stay within ${check.max} characters`;
    case "judge":
      return check.question;
  }
}

export function formatSkills(results: SkillResult[], options: { color: boolean }): string {
  const paint = (code: string, text: string) => (options.color ? `\x1b[${code}m${text}\x1b[0m` : text);
  const width = Math.max(...results.map((r) => r.skill.length));
  const out: string[] = [];
  for (const result of results) {
    const rate = result.total ? (result.passed / result.total) * 100 : 0;
    const tone = result.passed === result.total ? "32" : "33";
    out.push(`  ${result.skill.padEnd(width)}   ${paint(tone, `${Number(rate.toFixed(1))}%`.padStart(6))}   ${result.passed}/${result.total} cases`);
    for (const failed of result.cases.filter((c) => !c.passed)) {
      out.push(paint("90", `    ✗ ${failed.id}${failed.error ? `: ${failed.error}` : ""}`));
      for (const check of failed.checks.filter((c) => !c.passed)) {
        out.push(paint("90", `        ${describe(check.check)}${check.note ? ` (${check.note})` : ""}`));
      }
    }
  }
  const passed = results.reduce((n, r) => n + r.passed, 0);
  const total = results.reduce((n, r) => n + r.total, 0);
  out.push("", `  ${passed} of ${total} cases passed`);
  return out.join("\n");
}
