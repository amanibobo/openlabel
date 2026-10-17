// The fictional Lorvexa print ad that the site and the terminal demo both review.
// One source, so the two can't drift apart.

export const ad = { src: "/images/lorvexa-ad.png", width: 1200, height: 800 } as const;
export const piece = "pulse/lorvexa-print-0412";
export const label = { name: "lorvexa", title: "Lorvexa label rev 06/2026", sentences: 214 } as const;

export type Verdict = "supported" | "overstated" | "imagery" | "missing";

// Percent of the ad's width and height.
export type Box = { left: number; top: number; width: number; height: number };

export type Evidence =
  | { kind: "sentence"; ref: string; section: string; before: string; span: string; after: string; aside?: string }
  | { kind: "rule"; rule: string; text: string };

export type Claim = {
  id: string;
  verdict: Verdict;
  text: string;
  quoted: boolean;
  note: string;
  box: Box;
  evidence: Evidence;
};

function sentence(ref: string, section: string, text: string, span: string, aside?: string): Evidence {
  const at = text.indexOf(span);
  if (at < 0) throw new Error(`span not in sentence ${ref}: ${span}`);
  return {
    kind: "sentence",
    ref,
    section,
    before: text.slice(0, at),
    span,
    after: text.slice(at + span.length),
    ...(aside && { aside }),
  };
}

const iga = "At Week 16, 38% of patients treated with LORVEXA achieved IGA 0 (clear) or 1 (almost clear), compared to 9% with placebo.";

export const claims: readonly Claim[] = [
  {
    id: "headline",
    verdict: "overstated",
    text: "Live clear.",
    quoted: true,
    note: "Implies full clearance. 38% were clear or almost clear.",
    box: { left: 4.2, top: 5.2, width: 36.6, height: 12.4 },
    evidence: sentence("§14.1 ¶3", "Plaque psoriasis", iga, "38% of patients"),
  },
  {
    id: "body",
    verdict: "supported",
    text: "Clear or almost-clear skin at week 16",
    quoted: true,
    note: "Matches the IGA endpoint.",
    box: { left: 4.2, top: 24.9, width: 26.4, height: 3.6 },
    evidence: sentence("§14.1 ¶3", "Plaque psoriasis", iga, "achieved IGA 0 (clear) or 1 (almost clear)"),
  },
  {
    id: "subhead",
    verdict: "overstated",
    text: "Get back to the life you love",
    quoted: true,
    note: "Quality-of-life claim. The label reports DLQI change only.",
    box: { left: 4.2, top: 20, width: 29.4, height: 4.6 },
    evidence: sentence(
      "§14.3 ¶1",
      "Quality of life",
      "Mean change from baseline in DLQI total score at Week 16 was −6.1 with LORVEXA and −2.3 with placebo.",
      "Mean change from baseline in DLQI total score",
      "No label sentence supports a broader quality-of-life claim.",
    ),
  },
  {
    id: "imagery",
    verdict: "imagery",
    text: "Lifestyle image",
    quoted: false,
    note: "Shows a benefit §14 does not measure.",
    box: { left: 20, top: 29.5, width: 55.5, height: 59.5 },
    evidence: {
      kind: "rule",
      rule: "imagery.implied-benefit",
      text: "The image shows an outcome, strenuous outdoor activity, that §14 does not measure. Efficacy was assessed on skin clearance endpoints through Week 16.",
    },
  },
  {
    id: "isi",
    verdict: "missing",
    text: "Important Safety Information",
    quoted: false,
    note: "Not on the piece.",
    box: { left: 4.2, top: 88.5, width: 22, height: 6.5 },
    evidence: {
      kind: "rule",
      rule: "print.isi-present",
      text: "No Important Safety Information found. Print pieces that make an efficacy claim must include it.",
    },
  },
];

export function cite(evidence: Evidence): string {
  return evidence.kind === "sentence" ? evidence.ref : evidence.rule;
}
