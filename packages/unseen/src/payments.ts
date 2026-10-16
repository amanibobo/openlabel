import type { Fetch, Npi, Payments } from "./types.ts";

// Open Payments general payments, one dataset per program year.
export const OPEN_PAYMENTS: Record<number, string> = {
  2023: "fb3a65aa-c901-4a38-a813-b04b00dfa2a9",
  2024: "e6b17c6a-2534-4207-a4a1-6746a14911ff",
  2025: "fb0b1734-1410-429d-92f6-3f4b35218e5e",
};

type Page = {
  count: number;
  results: { total_amount_of_payment_usdollars: string; applicable_manufacturer_or_applicable_gpo_making_payment_name: string }[];
};

const PAGE = 500;

async function yearTotals(fetchFn: Fetch, npi: Npi, dataset: string) {
  let total = 0;
  const byPayer = new Map<string, number>();
  for (let offset = 0; ; offset += PAGE) {
    const params = new URLSearchParams({
      "conditions[0][property]": "covered_recipient_npi",
      "conditions[0][value]": npi,
      "conditions[0][operator]": "=",
      "properties[0]": "total_amount_of_payment_usdollars",
      "properties[1]": "applicable_manufacturer_or_applicable_gpo_making_payment_name",
      limit: String(PAGE),
      offset: String(offset),
      count: "true",
      results: "true",
      schema: "false",
      keys: "true",
    });
    const response = await fetchFn(`https://openpaymentsdata.cms.gov/api/1/datastore/query/${dataset}/0?${params}`);
    if (!response.ok) throw new Error(`Open Payments returned ${response.status}`);
    const page = (await response.json()) as Page;
    for (const row of page.results) {
      const amount = Number(row.total_amount_of_payment_usdollars) || 0;
      total += amount;
      const payer = row.applicable_manufacturer_or_applicable_gpo_making_payment_name;
      byPayer.set(payer, (byPayer.get(payer) ?? 0) + amount);
    }
    if (offset + PAGE >= page.count) break;
  }
  return { total, byPayer };
}

export async function payments(fetchFn: Fetch, npi: Npi, years = Object.keys(OPEN_PAYMENTS).map(Number)): Promise<Payments> {
  const byYear: Record<number, number> = {};
  const byPayer = new Map<string, number>();
  for (const year of years) {
    const dataset = OPEN_PAYMENTS[year];
    if (!dataset) throw new Error(`no Open Payments dataset for ${year}`);
    const result = await yearTotals(fetchFn, npi, dataset);
    byYear[year] = Math.round(result.total * 100) / 100;
    for (const [payer, amount] of result.byPayer) byPayer.set(payer, (byPayer.get(payer) ?? 0) + amount);
  }
  const top = [...byPayer].sort((a, b) => b[1] - a[1])[0];
  const total = Object.values(byYear).reduce((sum, n) => sum + n, 0);
  return { total: Math.round(total * 100) / 100, byYear, topPayer: top ? top[0] : null };
}
