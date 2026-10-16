import { claims, verdicts } from "./claims";

export type Phase = "reading" | "extracting" | "checking" | "done";

export type View = {
  phase: Phase;
  resolved: number;
  scanning: number | null;
  focus: number | null;
  spinner: string;
};

const SPINNER = "⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏";
const SPINNER_FRAME_MS = 80;

const READ_MS = 800;
const EXTRACT_MS = 900;
const SCAN_MS = 1300;
const HOLD_MS = 1100;
const SUMMARY_TO_FINAL_FOCUS_MS = 900;

const CHECK_START_MS = READ_MS + EXTRACT_MS;
const CLAIM_MS = SCAN_MS + HOLD_MS;
const CHECK_END_MS = CHECK_START_MS + claims.length * CLAIM_MS;

export const DEMO_DURATION_MS = CHECK_END_MS + SUMMARY_TO_FINAL_FOCUS_MS;

const finalFocus = claims.findIndex((c) => verdicts[c.verdict].label === "imagery");

export function viewAt(ms: number): View {
  const spinner = SPINNER[Math.floor(ms / SPINNER_FRAME_MS) % SPINNER.length]!;
  if (ms < READ_MS) return { phase: "reading", resolved: 0, scanning: null, focus: null, spinner };
  if (ms < CHECK_START_MS) return { phase: "extracting", resolved: 0, scanning: null, focus: null, spinner };
  if (ms < CHECK_END_MS) {
    const index = Math.floor((ms - CHECK_START_MS) / CLAIM_MS);
    const scanned = (ms - CHECK_START_MS) % CLAIM_MS >= SCAN_MS;
    // While a claim scans, the previous claim keeps focus so the detail pane never blanks.
    return scanned
      ? { phase: "checking", resolved: index + 1, scanning: null, focus: index, spinner }
      : { phase: "checking", resolved: index, scanning: index, focus: index > 0 ? index - 1 : null, spinner };
  }
  const focus = ms < DEMO_DURATION_MS ? claims.length - 1 : finalFocus;
  return { phase: "done", resolved: claims.length, scanning: null, focus, spinner: "" };
}
