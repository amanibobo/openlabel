export type Tone = "p" | "cmd" | "arg" | "out" | "dim" | "hi" | "ok" | "warn" | "bad";
export type Span = readonly [Tone, string];
export type Line = readonly Span[];

export type Session = {
  title: string;
  command: string;
  args: string;
  output: readonly Line[];
};

export function promptLine(command: string, args: string): Line {
  return [
    ["p", "❯ "],
    ["cmd", command],
    ["arg", args ? ` ${args}` : ""],
  ];
}

const blank: Line = [];

function col(text: string, width: number): string {
  return text.padEnd(width);
}

export const github = "https://github.com/amanibobo/openlabel";

/* Check */

export type Verdict = "supported" | "overstated" | "imagery" | "missing";

export const verdictTone: Record<Verdict, "ok" | "warn" | "bad"> = {
  supported: "ok",
  overstated: "warn",
  imagery: "bad",
  missing: "bad",
};

const verdictGlyph: Record<Verdict, string> = { supported: "✓", overstated: "~", imagery: "✗", missing: "✗" };

export type Box = { left: number; top: number; width: number; height: number };

export type Claim = {
  id: string;
  verdict: Verdict;
  text: string;
  note: string;
  cite: string;
  sentence: string | null;
  box: Box;
};

export const claims: readonly Claim[] = [
  {
    id: "headline",
    verdict: "overstated",
    text: "Live clear.",
    note: "The headline implies complete clearance. The label reports 38% clear or almost clear at week 16.",
    cite: "§14.1",
    sentence: "s-iga",
    box: { left: 5.5, top: 8, width: 42, height: 14 },
  },
  {
    id: "body",
    verdict: "supported",
    text: "Clear or almost-clear skin at week 16",
    note: "Matches the primary endpoint wording and timepoint.",
    cite: "§14.1 ¶3",
    sentence: "s-iga",
    box: { left: 5.5, top: 29.5, width: 28, height: 5 },
  },
  {
    id: "subhead",
    verdict: "overstated",
    text: "Get back to the life you love.",
    note: "A quality-of-life claim. The label only reports a change in DLQI score.",
    cite: "§14.3",
    sentence: "s-dlqi",
    box: { left: 5.5, top: 24, width: 32, height: 5.5 },
  },
  {
    id: "imagery",
    verdict: "imagery",
    text: "Lifestyle image",
    note: "Implies a benefit beyond the skin endpoints studied in §14. FDA cited this pattern repeatedly in its September 2025 letters.",
    cite: "§14",
    sentence: "s-scope",
    box: { left: 44.5, top: 53, width: 11, height: 23 },
  },
  {
    id: "isi",
    verdict: "missing",
    text: "Important Safety Information",
    note: "No safety information appears on the piece. Rule print.isi-present.",
    cite: "§5",
    sentence: "s-eye",
    box: { left: 5.5, top: 86, width: 60, height: 8 },
  },
];

export type LabelSection = {
  heading: string;
  sentences: readonly { id: string; text: string }[];
};

export const labelExcerpt: readonly LabelSection[] = [
  {
    heading: "5.3 Conjunctivitis and keratitis",
    sentences: [
      { id: "s-eye", text: "Conjunctivitis and keratitis occurred more frequently in patients who received LORVEXA." },
    ],
  },
  {
    heading: "14.1 Plaque psoriasis",
    sentences: [
      {
        id: "s-iga",
        text: "At Week 16, 38% of patients treated with LORVEXA achieved IGA 0 (clear) or 1 (almost clear), compared to 9% with placebo.",
      },
      { id: "s-scope", text: "Efficacy was assessed on skin clearance endpoints through Week 16." },
    ],
  },
  {
    heading: "14.3 Quality of life",
    sentences: [
      {
        id: "s-dlqi",
        text: "Mean change from baseline in DLQI total score at Week 16 was −6.1 with LORVEXA and −2.3 with placebo.",
      },
    ],
  },
];

export const checkSession: Session = {
  title: "openlabel check",
  command: "openlabel check",
  args: "pulse/lorvexa-print-0412 --label lorvexa",
  output: [
    [["dim", "  label    "], ["out", "Lorvexa (velorimab) prescribing information, rev 06/2026"]],
    [["dim", "  claims   "], ["out", `${claims.length} extracted, each matched against 214 label sentences`]],
    blank,
    ...claims.map(
      (c): Line => [
        [verdictTone[c.verdict], col(`  ${verdictGlyph[c.verdict]} ${c.verdict}`, 17)],
        ["out", col(c.verdict === "imagery" || c.verdict === "missing" ? c.text : `"${c.text}"`, 40)],
        ["dim", c.cite],
      ],
    ),
    blank,
    [["hi", "  1 supported, 2 overstated, 2 violations"], ["dim", " · exit 2"]],
  ],
};

/* Watch */

export type DiffLine = { kind: "same" | "del" | "add"; text: string };

export const labelDiff: readonly { section: string; lines: readonly DiffLine[] }[] = [
  {
    section: "2.2 Recommended dosage",
    lines: [
      { kind: "del", text: "Initial dose of 600 mg (two 300 mg injections)," },
      { kind: "add", text: "Initial dose of 400 mg (two 200 mg injections)," },
      { kind: "same", text: "followed by 300 mg every other week." },
    ],
  },
  {
    section: "5.3 Conjunctivitis and keratitis",
    lines: [
      { kind: "add", text: "Conjunctivitis and keratitis occurred more frequently" },
      { kind: "add", text: "in patients who received LORVEXA." },
    ],
  },
];

export type Piece = { file: string; kind: string; claims: number; reason: string; severity: "bad" | "warn" };

export const blastPieces: readonly Piece[] = [
  { file: "hcp-email-0311.html", kind: "Email", claims: 3, reason: "600 mg loading dose", severity: "bad" },
  { file: "sms-0412.md", kind: "SMS", claims: 1, reason: "safety link to rev 03/2026", severity: "bad" },
  { file: "leave-behind-0207.pdf", kind: "Leave-behind", claims: 2, reason: "ISI omits keratitis", severity: "bad" },
  { file: "dosing-calculator.json", kind: "Calculator", claims: 1, reason: "default dose 600 mg", severity: "warn" },
];

/* Unseen */

export type Prescriber = {
  npi: string;
  specialty: string;
  place: string;
  lat: number;
  lon: number;
  claims: number;
  payments: string;
  trials: number;
};

export type UnseenQuery = {
  label: string;
  stateFips: string;
  query: string;
  total: number;
  claimsLabel: string;
  rows: readonly Prescriber[];
};

export const unseenQueries: readonly UnseenQuery[] = [
  {
    label: "Georgia dermatology",
    stateFips: "13",
    query: "Georgia dermatologists with heavy psoriasis prescribing and no industry contact in three years",
    total: 38,
    claimsLabel: "Psoriasis claims",
    rows: [
      { npi: "1 4xx xxx 018", specialty: "Dermatology", place: "Valdosta", lat: 30.83, lon: -83.28, claims: 1284, payments: "$0", trials: 0 },
      { npi: "1 9xx xxx 377", specialty: "Dermatology", place: "Albany", lat: 31.58, lon: -84.16, claims: 1102, payments: "$0", trials: 0 },
      { npi: "1 2xx xxx 640", specialty: "Dermatology", place: "Rome", lat: 34.26, lon: -85.16, claims: 967, payments: "$0", trials: 1 },
      { npi: "1 6xx xxx 205", specialty: "Dermatology", place: "Waycross", lat: 31.21, lon: -82.35, claims: 911, payments: "$0", trials: 0 },
      { npi: "1 3xx xxx 852", specialty: "Dermatology", place: "Dalton", lat: 34.77, lon: -84.97, claims: 874, payments: "$0", trials: 0 },
    ],
  },
  {
    label: "Delta endocrinology",
    stateFips: "28",
    query: "Endocrinologists in the Mississippi Delta prescribing GLP-1s with under $100 in industry payments",
    total: 14,
    claimsLabel: "GLP-1 claims",
    rows: [
      { npi: "1 5xx xxx 731", specialty: "Endocrinology", place: "Greenville", lat: 33.41, lon: -91.06, claims: 2210, payments: "$42", trials: 0 },
      { npi: "1 8xx xxx 094", specialty: "Endocrinology", place: "Clarksdale", lat: 34.2, lon: -90.57, claims: 1876, payments: "$0", trials: 0 },
      { npi: "1 1xx xxx 563", specialty: "Internal medicine", place: "Cleveland", lat: 33.74, lon: -90.72, claims: 1540, payments: "$18", trials: 0 },
      { npi: "1 7xx xxx 419", specialty: "Endocrinology", place: "Greenwood", lat: 33.52, lon: -90.18, claims: 1322, payments: "$0", trials: 0 },
    ],
  },
  {
    label: "New Mexico oncology",
    stateFips: "35",
    query: "New Mexico oncologists enrolling in trials who have had no industry contact since 2023",
    total: 9,
    claimsLabel: "Oral oncolytic claims",
    rows: [
      { npi: "1 3xx xxx 276", specialty: "Hematology and oncology", place: "Farmington", lat: 36.73, lon: -108.22, claims: 412, payments: "$0", trials: 3 },
      { npi: "1 6xx xxx 980", specialty: "Medical oncology", place: "Las Cruces", lat: 32.32, lon: -106.76, claims: 388, payments: "$0", trials: 2 },
      { npi: "1 2xx xxx 145", specialty: "Medical oncology", place: "Roswell", lat: 33.39, lon: -104.52, claims: 301, payments: "$0", trials: 1 },
    ],
  },
];

/* Skills */

export type Skill = { name: string; summary: string; cases: number; pass: number };

export const skills: readonly Skill[] = [
  { name: "med-info-response", summary: "Drafts the standard response letter to an unsolicited HCP question.", cases: 48, pass: 46 },
  { name: "claim-check", summary: "Runs Check from inside an agent and explains each verdict.", cases: 120, pass: 113 },
  { name: "fair-balance", summary: "Weighs risk prominence against benefit claims in a draft.", cases: 64, pass: 61 },
  { name: "label-diff", summary: "Summarizes what changed between two label revisions.", cases: 40, pass: 40 },
  { name: "hcp-sms", summary: "Writes 160-character variants that keep their safety link.", cases: 80, pass: 74 },
];
