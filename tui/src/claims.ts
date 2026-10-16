export const IMAGE_PATH = new URL("../../apps/web/public/images/lorvexa-ad.png", import.meta.url).pathname;
export const IMAGE_SIZE = { width: 1200, height: 800 } as const;

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

export type Verdict = "supported" | "overstated" | "imagery" | "missing";
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

// Same numbers the site uses: left, top, width, height as percent of the image.
const pct = (left: number, top: number, width: number, height: number): Region => ({
  x0: (left / 100) * IMAGE_SIZE.width,
  y0: (top / 100) * IMAGE_SIZE.height,
  x1: ((left + width) / 100) * IMAGE_SIZE.width,
  y1: ((top + height) / 100) * IMAGE_SIZE.height,
});

export type Evidence =
  | { kind: "sentence"; ref: string; section: string; before: string; span: string; after: string; aside?: string }
  | { kind: "rule"; rule: string; text: string };

export type Claim = {
  verdict: Verdict;
  text: string;
  quoted: boolean;
  note: string;
  region: Region | null;
  evidence: Evidence;
};

export const piece = "pulse/lorvexa-print-0412";
export const label = { name: "lorvexa", title: "Lorvexa label rev 06/2026", sentences: 214 };

const iga = "At Week 16, 38% of patients treated with LORVEXA achieved IGA 0 (clear) or 1 (almost clear), compared to 9% with placebo.";

function sentence(ref: string, section: string, text: string, span: string, aside?: string): Evidence {
  const at = text.indexOf(span);
  if (at < 0) throw new Error(`span not in sentence ${ref}: ${span}`);
  return { kind: "sentence", ref, section, before: text.slice(0, at), span, after: text.slice(at + span.length), aside };
}

export const claims: readonly Claim[] = [
  {
    verdict: "overstated",
    text: "Live clear.",
    quoted: true,
    note: "Implies full clearance. 38% were clear or almost clear.",
    region: pct(4.2, 5.2, 36.6, 12.4),
    evidence: sentence("§14.1 ¶3", "Plaque psoriasis", iga, "38% of patients"),
  },
  {
    verdict: "supported",
    text: "Clear or almost-clear skin at week 16",
    quoted: true,
    note: "Matches the IGA endpoint.",
    region: pct(4.2, 24.9, 26.4, 3.6),
    evidence: sentence("§14.1 ¶3", "Plaque psoriasis", iga, "achieved IGA 0 (clear) or 1 (almost clear)"),
  },
  {
    verdict: "overstated",
    text: "Get back to the life you love",
    quoted: true,
    note: "Quality-of-life claim. The label reports DLQI change only.",
    region: pct(4.2, 20, 29.4, 4.6),
    evidence: sentence(
      "§14.3 ¶1",
      "Quality of life",
      "Mean change from baseline in DLQI total score at Week 16 was −6.1 with LORVEXA and −2.3 with placebo.",
      "Mean change from baseline in DLQI total score",
      "No label sentence supports a broader quality-of-life claim.",
    ),
  },
  {
    verdict: "imagery",
    text: "Lifestyle image",
    quoted: false,
    note: "Shows a benefit §14 does not measure.",
    region: pct(20, 29.5, 55.5, 59.5),
    evidence: {
      kind: "rule",
      rule: "imagery.implied-benefit",
      text: "The image shows an outcome, strenuous outdoor activity, that §14 does not measure. Efficacy was assessed on skin clearance endpoints through Week 16.",
    },
  },
  {
    verdict: "missing",
    text: "Important Safety Information",
    quoted: false,
    note: "Not on the piece.",
    region: pct(4.2, 88.5, 22, 6.5),
    evidence: {
      kind: "rule",
      rule: "print.isi-present",
      text: "No Important Safety Information found. Print pieces that make an efficacy claim must include it.",
    },
  },
];

export const summary = (["ok", "warn", "bad"] as const).map((tone) => ({
  tone,
  text: tones[tone].count(claims.filter((c) => verdicts[c.verdict].tone === tone).length),
}));

export const exitCode = Math.max(...claims.map((c) => tones[verdicts[c.verdict].tone].exit));

export function cite(evidence: Evidence): string {
  return evidence.kind === "sentence" ? evidence.ref : evidence.rule;
}
