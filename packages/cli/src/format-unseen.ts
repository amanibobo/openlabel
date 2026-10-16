import type { UnseenResult } from "@openlabel/unseen";

const money = (n: number) => `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

function table(rows: string[][], rightAligned: Set<number>): string[] {
  const widths = rows[0]!.map((_, i) => Math.max(...rows.map((r) => r[i]!.length)));
  return rows.map((r) => r.map((cell, i) => (rightAligned.has(i) ? cell.padStart(widths[i]!) : cell.padEnd(widths[i]!))).join("   ").trimEnd());
}

export function formatUnseen(result: UnseenResult, options: { color: boolean }): string {
  const dim = (text: string) => (options.color ? `\x1b[90m${text}\x1b[0m` : text);
  const { search } = result;
  const years = `${result.paymentYears[0]}–${result.paymentYears.at(-1)}`;
  const limit = search.maxPayments === null ? "" : `, at most ${money(search.maxPayments)} in industry payments ${years}`;
  const out = [
    `${search.specialty} in ${search.state} prescribing ${search.drugs.join(", ")}${limit}`,
    "",
  ];

  if (!result.candidates.length) {
    out.push("  no prescribers match");
  } else {
    const rows = [
      ["NPI", "Name", "Location", `Claims ${result.claimsYear}`, `Payments ${years}`, "Possible trials"],
      ...result.candidates.map((c) => [
        c.npi,
        `${c.first} ${c.last}${c.location?.credential ? `, ${c.location.credential}` : ""}`,
        `${c.location?.city ?? c.city}, ${c.location?.state ?? search.state}`,
        c.claims.toLocaleString("en-US"),
        money(c.payments.total),
        c.trials.map((t) => t.nctId).join(" ") || "none",
      ]),
    ];
    const [header, ...body] = table(rows, new Set([3, 4]));
    out.push(`  ${dim(header!)}`, ...body.map((line) => `  ${line}`));
  }

  out.push(
    "",
    dim(`  ${result.candidates.length} shown from ${result.scanned} top prescribers checked. Prescribing is Medicare Part D ${result.claimsYear}, about two years behind.`),
    dim("  Trial matches come from names on ClinicalTrials.gov sites and need checking."),
  );
  if (result.unmatchedDrugs.length) {
    out.push(dim(`  No Part D prescribing for ${result.unmatchedDrugs.join(", ")} (misspelled, or billed under Part B).`));
  }
  return out.join("\n");
}
