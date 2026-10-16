import type { Label } from "@openlabel/label";
import type { ClaimModel } from "./model.ts";
import { retriever } from "./retrieve.ts";
import { FDA_CORE, runRules, type RulePack } from "./rules.ts";
import { exitCodeFor, type CheckedClaim, type Claim, type Report } from "./types.ts";

export type CheckOptions = {
  piece: string;
  label: Label;
  model: ClaimModel;
  pack?: RulePack;
  concurrency?: number;
};

export function locate(piece: string, text: string): { start: number; end: number } | null {
  const exact = piece.indexOf(text);
  if (exact >= 0) return { start: exact, end: exact + text.length };
  const words = text.trim().split(/\s+/).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (!words.length) return null;
  const match = new RegExp(words.join("\\s+"), "i").exec(piece);
  return match ? { start: match.index, end: match.index + match[0].length } : null;
}

async function mapLimit<T, R>(items: readonly T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (let i = next++; i < items.length; i = next++) results[i] = await fn(items[i] as T);
  });
  await Promise.all(workers);
  return results;
}

export async function check({ piece, label, model, pack = FDA_CORE, concurrency = 4 }: CheckOptions): Promise<Report> {
  const extracted = await model.extract(piece, label.title);
  const seen = new Set<string>();
  const claims: Claim[] = [];
  for (const [i, c] of extracted.entries()) {
    const span = locate(piece, c.text);
    if (!span || seen.has(`${span.start}:${span.end}`)) continue;
    seen.add(`${span.start}:${span.end}`);
    claims.push({ id: `c${i + 1}`, text: piece.slice(span.start, span.end), kind: c.kind, ...span });
  }

  const retrieve = retriever(label);
  const judged = await mapLimit(claims, concurrency, async (claim): Promise<CheckedClaim> => {
    const candidates = retrieve(claim.text, claim.kind);
    const raw = await model.judge({ labelTitle: label.title, claim: claim.text, kind: claim.kind, candidates });
    const evidenceText = candidates.filter((s) => raw.evidence.includes(s.id));
    const verdict = raw.verdict === "supported" && evidenceText.length === 0 ? "unsupported" : raw.verdict;
    return { ...claim, verdict, evidence: evidenceText.map((s) => s.id), evidenceText, reason: raw.reason };
  });
  judged.sort((a, b) => a.start - b.start);

  const findings = runRules(pack, piece, judged);
  return {
    piece,
    label: { setId: label.setId, version: label.version, title: label.title },
    claims: judged,
    findings,
    exitCode: exitCodeFor(judged, findings),
  };
}
