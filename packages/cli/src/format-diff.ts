import type { LabelDiff } from "@openlabel/watch";

export function formatDiff(diff: LabelDiff, options: { color: boolean }): string {
  const paint = (code: string, text: string) => (options.color ? `\x1b[${code}m${text}\x1b[0m` : text);
  const out = [
    `${paint("1", diff.title)} ${paint("90", `· v${diff.from.version} (${diff.from.effectiveDate}) to v${diff.to.version} (${diff.to.effectiveDate})`)}`,
  ];
  if (!diff.sections.length) {
    out.push("", "  no changes to the prescribing information");
    return out.join("\n");
  }
  for (const section of diff.sections) {
    out.push("", `  §${section.section} ${section.title} ${paint("90", `· ${section.category}, ${section.status}`)}`);
    for (const change of section.changes) {
      if (change.kind !== "added") out.push(`    ${paint("31", `- ${change.before.text}`)}`);
      if (change.kind !== "removed") out.push(`    ${paint("32", `+ ${change.after.text}`)}`);
    }
  }
  return out.join("\n");
}
