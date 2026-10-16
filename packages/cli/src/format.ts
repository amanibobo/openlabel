import { VERDICTS, type Report, type Verdict } from "@openlabel/check";
import { cite } from "@openlabel/label";

type Tone = "ok" | "warn" | "bad" | "dim" | "ink";

const ANSI: Record<Tone, string> = { ok: "32", warn: "33", bad: "31", dim: "90", ink: "1" };

const VERDICT_STYLE: Record<Verdict, { glyph: string; tone: Tone }> = {
  supported: { glyph: "✓", tone: "ok" },
  overstated: { glyph: "~", tone: "warn" },
  "off-label": { glyph: "✗", tone: "bad" },
  unsupported: { glyph: "✗", tone: "bad" },
};

function wrap(text: string, width: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    if (line && line.length + word.length + 1 > width) {
      lines.push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export function formatReport(report: Report, options: { color: boolean; width?: number }): string {
  const paint = (tone: Tone, text: string) => (options.color ? `\x1b[${ANSI[tone]}m${text}\x1b[0m` : text);
  const width = Math.max(options.width ?? 100, 60);
  const indent = " ".repeat(17);
  const out: string[] = [];

  out.push(
    `${paint("ink", report.label.title)} ${paint("dim", `· label v${report.label.version} · ${report.claims.length} claims`)}`,
    "",
  );

  for (const claim of report.claims) {
    const { glyph, tone } = VERDICT_STYLE[claim.verdict];
    const cites = [...new Set(claim.evidenceText.map(cite))].join(", ");
    out.push(`  ${paint(tone, `${glyph} ${claim.verdict}`.padEnd(14))} ${paint("ink", `“${claim.text}”`)}${cites ? `  ${paint("dim", cites)}` : ""}`);
    for (const line of wrap(claim.reason, width - indent.length)) out.push(`${indent}${paint("dim", line)}`);
  }

  if (report.findings.length) out.push("");
  for (const finding of report.findings) {
    const tone: Tone = finding.severity === "violation" ? "bad" : "warn";
    out.push(`  ${paint(tone, `${finding.severity === "violation" ? "✗" : "!"} ${finding.rule}`)}  ${finding.message}`);
  }

  const summary = VERDICTS.flatMap((verdict) => {
    const n = report.claims.filter((c) => c.verdict === verdict).length;
    return n ? [`${n} ${verdict}`] : [];
  });
  if (report.findings.length) summary.push(`${report.findings.length} rule ${report.findings.length === 1 ? "finding" : "findings"}`);
  summary.push(`exit ${report.exitCode}`);
  out.push("", `  ${summary.join(" · ")}`);
  return out.join("\n");
}
