export const github = "https://github.com/amanibobo/openlabel";
export const docs = "https://au-2a4a5dc8.mintlify.app";
export const youtube = "https://www.youtube.com/";

/* Check */

export type Verdict = "supported" | "overstated" | "imagery" | "missing";

export const verdictTone: Record<Verdict, "ok" | "warn" | "bad"> = {
  supported: "ok",
  overstated: "warn",
  imagery: "bad",
  missing: "bad",
};

export type Box = { left: number; top: number; width: number; height: number };

export type Claim = {
  id: string;
  verdict: Verdict;
  text: string;
  quoted: boolean;
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
    quoted: true,
    note: "Implies complete clearance. The label reports 38% clear or almost clear.",
    cite: "§14.1",
    sentence: "s-iga",
    box: { left: 4.2, top: 5.2, width: 36.6, height: 12.4 },
  },
  {
    id: "body",
    verdict: "supported",
    text: "Clear or almost-clear skin at week 16",
    quoted: true,
    note: "Matches the primary endpoint and its timepoint.",
    cite: "§14.1 ¶3",
    sentence: "s-iga",
    box: { left: 4.2, top: 24.9, width: 26.4, height: 3.6 },
  },
  {
    id: "subhead",
    verdict: "overstated",
    text: "Get back to the life you love.",
    quoted: true,
    note: "A quality-of-life promise. The label only reports a DLQI change.",
    cite: "§14.3",
    sentence: "s-dlqi",
    box: { left: 4.2, top: 20, width: 29.4, height: 4.6 },
  },
  {
    id: "imagery",
    verdict: "imagery",
    text: "Lifestyle image",
    quoted: false,
    note: "Shows a benefit the trials never measured, a pattern FDA cites often.",
    cite: "§14",
    sentence: "s-scope",
    box: { left: 20, top: 29.5, width: 55.5, height: 59.5 },
  },
  {
    id: "isi",
    verdict: "missing",
    text: "Important Safety Information",
    quoted: false,
    note: "No safety information anywhere on the piece.",
    cite: "§5",
    sentence: "s-eye",
    box: { left: 4.2, top: 88.5, width: 22, height: 6.5 },
  },
];

export const labelSentences: Record<string, string> = {
  "s-eye": "Conjunctivitis and keratitis occurred more frequently in patients who received LORVEXA.",
  "s-iga":
    "At Week 16, 38% of patients treated with LORVEXA achieved IGA 0 (clear) or 1 (almost clear), compared to 9% with placebo.",
  "s-scope": "Efficacy was assessed on skin clearance endpoints through Week 16.",
  "s-dlqi": "Mean change from baseline in DLQI total score at Week 16 was −6.1 with LORVEXA and −2.3 with placebo.",
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
  { name: "claim-check", summary: "Checks copy against the label and rewrites every claim that overreaches.", cases: 4, pass: 4 },
  { name: "label-diff", summary: "Explains a label change and what it means for approved content.", cases: 4, pass: 4 },
  { name: "fair-balance", summary: "Weighs risk prominence against benefit claims and drafts risk language.", cases: 3, pass: 3 },
  { name: "hcp-sms", summary: "Writes 160-character variants of approved copy and checks each one.", cases: 3, pass: 3 },
  { name: "med-info-response", summary: "Drafts a cited response to an unsolicited HCP question.", cases: 4, pass: 4 },
];
