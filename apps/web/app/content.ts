import type { Verdict } from "@openlabel/lorvexa";

export const github = "https://github.com/amanibobo/openlabel";
export const docs = "https://au-2a4a5dc8.mintlify.app";
export const youtube = "https://www.youtube.com/";

/* Check */

export const verdictTone: Record<Verdict, "ok" | "warn" | "bad"> = {
  supported: "ok",
  overstated: "warn",
  imagery: "bad",
  missing: "bad",
};

/* Watch */

export type DiffLine = { kind: "same" | "del" | "add"; text: string };

// One changed section of the label. `angle` places it on the blast-radius ring.
export type LabelChange = { section: string; title: string; short: string; angle: number; lines: readonly DiffLine[] };

export const labelChanges: readonly LabelChange[] = [
  {
    section: "2.2",
    title: "Recommended dosage",
    short: "dosing",
    angle: 200,
    lines: [
      { kind: "del", text: "Initial dose of 600 mg (two 300 mg injections)," },
      { kind: "add", text: "Initial dose of 400 mg (two 200 mg injections)," },
      { kind: "same", text: "followed by 300 mg every other week." },
    ],
  },
  {
    section: "5.3",
    title: "Conjunctivitis and keratitis",
    short: "new warning",
    angle: -20,
    lines: [
      { kind: "add", text: "Conjunctivitis and keratitis occurred more frequently" },
      { kind: "add", text: "in patients who received LORVEXA." },
    ],
  },
];

// An approved piece the change broke, and which changed section broke it.
export type Piece = { file: string; section: string; angle: number; claims: number; reason: string; severity: "bad" | "warn" };

export const blastPieces: readonly Piece[] = [
  { file: "hcp-email-0311.html", section: "2.2", angle: 232, claims: 3, reason: "600 mg loading dose", severity: "bad" },
  { file: "sms-0412.md", section: "5.3", angle: -52, claims: 1, reason: "safety link to rev 03/2026", severity: "bad" },
  { file: "leave-behind-0207.pdf", section: "5.3", angle: 28, claims: 2, reason: "ISI omits keratitis", severity: "bad" },
  { file: "dosing-calculator.json", section: "2.2", angle: 152, claims: 1, reason: "default dose 600 mg", severity: "warn" },
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
