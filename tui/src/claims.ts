import * as lorvexa from "../../packages/lorvexa/src/index.ts";

export const IMAGE_PATH = new URL("../../apps/web/public/images/lorvexa-ad.png", import.meta.url).pathname;
export const IMAGE_SIZE = { width: lorvexa.ad.width, height: lorvexa.ad.height } as const;

export const palette = {
  bg: "#151516",
  ink: "#f5f5f7",
  body: "#86868b",
  dim: "#6e6e73",
  arg: "#a1a1a6",
  line: "#232325",
  surface: "#1f1f21",
  ok: "#7cc79a",
  warn: "#dcb468",
  bad: "#e9857a",
} as const;

export type Verdict = lorvexa.Verdict;
export type Evidence = lorvexa.Evidence;
export type Tone = "ok" | "warn" | "bad";

export const tones: Record<Tone, { color: string; exit: number; count: (n: number) => string }> = {
  ok: { color: palette.ok, exit: 0, count: (n) => `${n} supported` },
  warn: { color: palette.warn, exit: 1, count: (n) => `${n} overstated` },
  bad: { color: palette.bad, exit: 2, count: (n) => `${n} ${n === 1 ? "violation" : "violations"}` },
};

export const verdicts: Record<Verdict, { glyph: "✓" | "~" | "✗"; tone: Tone; color: string; label: string }> = {
  supported: { glyph: "✓", tone: "ok", color: tones.ok.color, label: "supported" },
  overstated: { glyph: "~", tone: "warn", color: tones.warn.color, label: "overstated" },
  imagery: { glyph: "✗", tone: "bad", color: tones.bad.color, label: "imagery" },
  missing: { glyph: "✗", tone: "bad", color: tones.bad.color, label: "missing" },
};

export type Region = { x0: number; y0: number; x1: number; y1: number };

// The shared boxes are percent of the image; the scene draws in image pixels.
const region = ({ left, top, width, height }: lorvexa.Box): Region => ({
  x0: (left / 100) * IMAGE_SIZE.width,
  y0: (top / 100) * IMAGE_SIZE.height,
  x1: ((left + width) / 100) * IMAGE_SIZE.width,
  y1: ((top + height) / 100) * IMAGE_SIZE.height,
});

export type Claim = lorvexa.Claim & { region: Region };

export const piece = lorvexa.piece;
export const label = lorvexa.label;
export const cite = lorvexa.cite;

export const claims: readonly Claim[] = lorvexa.claims.map((c) => ({ ...c, region: region(c.box) }));

export const summary = (["ok", "warn", "bad"] as const).map((tone) => ({
  tone,
  text: tones[tone].count(claims.filter((c) => verdicts[c.verdict].tone === tone).length),
}));

export const exitCode = Math.max(...claims.map((c) => tones[verdicts[c.verdict].tone].exit));
