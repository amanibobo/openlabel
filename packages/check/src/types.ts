import type { Label, Sentence, SentenceId } from "@openlabel/label";

export const CLAIM_KINDS = ["efficacy", "safety", "dosing", "indication", "quality-of-life", "comparative", "other"] as const;
export type ClaimKind = (typeof CLAIM_KINDS)[number];

export const VERDICTS = ["supported", "overstated", "off-label", "unsupported"] as const;
export type Verdict = (typeof VERDICTS)[number];

export type Claim = {
  id: string;
  text: string;
  kind: ClaimKind;
  query: string;
  // Character offsets into the piece; extraction output that isn't in the piece is rejected.
  start: number;
  end: number;
};

export type Judgment = {
  verdict: Verdict;
  evidence: SentenceId[];
  reason: string;
};

export type CheckedClaim = Claim & Judgment & { evidenceText: Sentence[] };

export type Severity = "violation" | "warning";

export type RuleFinding = {
  rule: string;
  severity: Severity;
  message: string;
};

export type ExitCode = 0 | 1 | 2;

export type Report = {
  piece: string;
  label: Pick<Label, "setId" | "version" | "title">;
  claims: CheckedClaim[];
  findings: RuleFinding[];
  exitCode: ExitCode;
};

export function exitCodeFor(claims: readonly Judgment[], findings: readonly RuleFinding[]): ExitCode {
  const verdicts = new Set(claims.map((c) => c.verdict));
  const severities = new Set(findings.map((f) => f.severity));
  if (verdicts.has("off-label") || verdicts.has("unsupported") || severities.has("violation")) return 2;
  if (verdicts.has("overstated") || severities.has("warning")) return 1;
  return 0;
}
