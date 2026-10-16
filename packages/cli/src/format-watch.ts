import { relative } from "node:path";
import { cite } from "@openlabel/label";
import type { Category, Impact, LabelDiff, WatchResult } from "@openlabel/watch";

const CATEGORY_NAMES: Record<Category, string> = {
  "boxed-warning": "boxed warning",
  indication: "indication",
  dosing: "dosing",
  contraindication: "contraindication",
  warning: "warning",
  "adverse-reactions": "adverse reactions",
  "clinical-studies": "clinical studies",
  other: "other",
};

type Paint = (tone: "ok" | "warn" | "bad" | "dim" | "ink", text: string) => string;

function summarizeDiff(diff: LabelDiff): string {
  const byCategory = new Map<Category, string[]>();
  for (const s of diff.sections) byCategory.set(s.category, [...(byCategory.get(s.category) ?? []), `§${s.section}`]);
  return [...byCategory].map(([category, sections]) => `${CATEGORY_NAMES[category]} ${sections.join(" ")}`).join(", ");
}

function clip(text: string, max = 110): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function describeImpact(impact: Impact, paint: Paint): string[] {
  if (impact.kind === "safety-information-outdated") {
    return [`    ${paint("warn", "safety information")}  §${impact.section.section} ${impact.section.title} changed`];
  }
  if (impact.kind === "indication-changed") {
    return [`    ${paint("ink", `“${impact.claim.text}”`)}  ${paint("dim", `indication §${impact.section.section} changed`)}`];
  }
  const lines = [`    ${paint("ink", `“${impact.claim.text}”`)}  ${paint("dim", `cites ${cite(impact.cited)}, which ${impact.change.kind === "removed" ? "was removed" : "changed"}`)}`];
  if (impact.change.kind === "changed") {
    lines.push(`      ${paint("dim", "was")}  ${clip(impact.change.before.text)}`, `      ${paint("dim", "now")}  ${clip(impact.change.after.text)}`);
  }
  return lines;
}

export function formatWatch(result: WatchResult, options: { color: boolean; cwd?: string }): string {
  const ANSI = { ok: "32", warn: "33", bad: "31", dim: "90", ink: "1" } as const;
  const paint: Paint = (tone, text) => (options.color ? `\x1b[${ANSI[tone]}m${text}\x1b[0m` : text);
  const name = (file: string) => relative(options.cwd ?? process.cwd(), file);
  const out: string[] = [];

  const seen = new Set<string>();
  for (const { diff } of result.pieces) {
    const key = `${diff.setId}:${diff.from.version}:${diff.to.version}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(
      `${paint("ink", diff.title)} ${paint("dim", `· v${diff.from.version} (${diff.from.effectiveDate}) to v${diff.to.version} (${diff.to.effectiveDate})`)}`,
      `  ${diff.sections.length ? summarizeDiff(diff) : "no changes to the prescribing information"}`,
      "",
    );
  }

  const affected = result.pieces.filter((p) => p.impacts.length);
  const claims = new Set(affected.flatMap((p) => p.impacts.flatMap((i) => (i.kind === "safety-information-outdated" ? [] : [`${p.file}:${i.claim.id}`]))));
  out.push(`  ${paint("ink", "blast radius")}  ${affected.length} ${affected.length === 1 ? "piece" : "pieces"}, ${claims.size} ${claims.size === 1 ? "claim" : "claims"}`);

  for (const piece of result.pieces) {
    if (!piece.impacts.length) {
      out.push(`  ${paint("ok", "✓")} ${name(piece.file)}  ${paint("dim", "label changed, nothing it relies on did")}`);
      continue;
    }
    out.push(`  ${paint("bad", "✗")} ${name(piece.file)}`);
    for (const impact of piece.impacts) out.push(...describeImpact(impact, paint));
  }
  for (const piece of result.current) out.push(`  ${paint("ok", "✓")} ${name(piece.file)}  ${paint("dim", "checked against the current label")}`);
  return out.join("\n");
}
