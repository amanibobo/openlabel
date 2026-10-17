import { VERDICTS, type CheckedClaim, type RuleFinding, type Verdict } from "@openlabel/check";
import { cite } from "@openlabel/label";

// Pure layout for the interactive check: state in, styled lines per pane out.

export const palette = {
  bg: "#151516",
  ink: "#f5f5f7",
  body: "#86868b",
  dim: "#6e6e73",
  line: "#2a2a2c",
  select: "#1f1f21",
  ok: "#7cc79a",
  warn: "#dcb468",
  bad: "#e9857a",
} as const;

export type Segment = { text: string; color: string; strong?: boolean };
export type Line = Segment[];

const VERDICT_STYLE: Record<Verdict, { glyph: string; color: string }> = {
  supported: { glyph: "✓", color: palette.ok },
  overstated: { glyph: "~", color: palette.warn },
  "off-label": { glyph: "✗", color: palette.bad },
  unsupported: { glyph: "✗", color: palette.bad },
};

export type CheckState = {
  file: string;
  label: string;
  phase: "fetching" | "extracting" | "judging" | "done" | "failed";
  total: number;
  claims: CheckedClaim[];
  findings: RuleFinding[];
  exitCode: number | null;
  error: string | null;
  selected: number;
};

export const initialState = (file: string, label: string): CheckState => ({
  file,
  label,
  phase: "fetching",
  total: 0,
  claims: [],
  findings: [],
  exitCode: null,
  error: null,
  selected: 0,
});

const seg = (text: string, color: string, strong = false): Segment => ({ text, color, ...(strong && { strong }) });

export function wrap(text: string, width: number, color: string): Line[] {
  const lines: Line[] = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    if (line && line.length + word.length + 1 > width) {
      lines.push([seg(line, color)]);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line) lines.push([seg(line, color)]);
  return lines;
}

function clip(text: string, width: number): string {
  return text.length > width ? `${text.slice(0, Math.max(0, width - 1))}…` : text;
}

export function header(state: CheckState): Line {
  return [seg("openlabel check ", palette.ink, true), seg(`${state.file} `, palette.body), seg(`· ${state.label}`, palette.dim)];
}

// Claims in the order they appear in the piece, the selected one marked.
export function claimList(state: CheckState, width: number): Line[] {
  if (!state.claims.length) {
    const waiting = state.phase === "done" ? "no claims found" : "claims appear here as they are judged";
    return [[seg(waiting, palette.dim)]];
  }
  return state.claims.map((claim, i) => {
    const { glyph, color } = VERDICT_STYLE[claim.verdict];
    const on = i === state.selected;
    const label = `${glyph} ${claim.verdict}`.padEnd(14);
    return [
      seg(on ? "▍ " : "  ", on ? color : palette.dim),
      seg(label, color),
      seg(clip(`“${claim.text}”`, width - 16), on ? palette.ink : palette.body, on),
    ];
  });
}

// The selected claim in full: verdict, reason, then every label sentence it rests on.
export function detail(state: CheckState, width: number): Line[] {
  const claim = state.claims[state.selected];
  if (!claim) return [];
  const { glyph, color } = VERDICT_STYLE[claim.verdict];
  const lines: Line[] = [
    [seg(`${glyph} ${claim.verdict}`, color, true), seg(`  ${claim.kind}`, palette.dim)],
    [],
    ...wrap(`“${claim.text}”`, width, palette.ink),
    [],
    ...wrap(claim.reason, width, palette.body),
  ];
  for (const sentence of claim.evidenceText) {
    lines.push([], [seg(cite(sentence), palette.dim)]);
    if (sentence.context) lines.push(...wrap(sentence.context, width, palette.dim));
    lines.push(...wrap(sentence.text, width, palette.body));
  }
  if (!claim.evidenceText.length) lines.push([], [seg("No label sentence cited.", palette.dim)]);
  return lines;
}

export function findingLines(state: CheckState, width: number): Line[] {
  return state.findings.map((f) => {
    const color = f.severity === "violation" ? palette.bad : palette.warn;
    return [seg(`${f.severity === "violation" ? "✗" : "!"} ${f.rule}  `, color), seg(clip(f.message, width - f.rule.length - 4), palette.body)];
  });
}

export function footer(state: CheckState, spinner: string): Line {
  const keys = seg("↑↓ move   q quit", palette.dim);
  switch (state.phase) {
    case "fetching":
      return [seg(`${spinner} fetching the ${state.label} label`, palette.dim)];
    case "extracting":
      return [seg(`${spinner} extracting claims`, palette.dim)];
    case "judging":
      return [seg(`${spinner} judging claims ${state.claims.length}/${state.total}   `, palette.dim), keys];
    case "failed":
      return [seg(`openlabel: ${state.error}`, palette.bad), seg("   q quit", palette.dim)];
    case "done": {
      const counts = VERDICTS.flatMap((v) => {
        const n = state.claims.filter((c) => c.verdict === v).length;
        return n ? [seg(`${n} ${v}`, VERDICT_STYLE[v].color), seg(" · ", palette.dim)] : [];
      });
      const rules = state.findings.length
        ? [seg(`${state.findings.length} rule ${state.findings.length === 1 ? "finding" : "findings"}`, palette.warn), seg(" · ", palette.dim)]
        : [];
      return [...counts, ...rules, seg(`exit ${state.exitCode}   `, palette.dim), keys];
    }
  }
}

export function move(state: CheckState, by: number): CheckState {
  if (!state.claims.length) return state;
  return { ...state, selected: Math.min(Math.max(state.selected + by, 0), state.claims.length - 1) };
}
