import type { Fetch, Npi, Payments } from "./types.ts";

// Open Payments general payments, one dataset per program year.
export const OPEN_PAYMENTS: Record<number, string> = {
  2023: "fb3a65aa-c901-4a38-a813-b04b00dfa2a9",
  2024: "e6b17c6a-2534-4207-a4a1-6746a14911ff",
  2025: "fb0b1734-1410-429d-92f6-3f4b35218e5e",
};

// Open Payments sits behind a firewall that blocks a network for a while after too many
// requests, so payments are totalled for a whole batch of prescribers per request, the
// requests go one at a time, and a refused one is retried after a growing pause.
const PAGE = 500;
const RETRY_STATUSES = new Set([403, 429, 500, 502, 503, 504]);
const RETRY_DELAYS_MS = [2000, 5000, 10000];

export const USER_AGENT = "openlabel/0.1 (+https://github.com/amanibobo/openlabel)";

const NPI = "covered_recipient_npi";
const PAYER = "applicable_manufacturer_or_applicable_gpo_making_payment_name";
const AMOUNT = "total_amount_of_payment_usdollars";

export type Sleep = (ms: number) => Promise<void>;
const sleep: Sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function post(fetchFn: Fetch, url: string, body: unknown, wait: Sleep): Promise<Response> {
  // The firewall turns away Node's default user agent ("node") as a bot, so say who's asking.
  const init = {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json", "user-agent": USER_AGENT },
    body: JSON.stringify(body),
  };
  for (let attempt = 0; ; attempt++) {
    const response = await fetchFn(url, init);
    const delay = RETRY_DELAYS_MS[attempt];
    if (response.ok || !RETRY_STATUSES.has(response.status) || delay === undefined) return response;
    await wait(delay);
  }
}

type Row = { [NPI]: string; [PAYER]: string; total: string | number | null };

// One row per prescriber and paying company: that company's total for the year.
async function yearTotals(fetchFn: Fetch, npis: readonly Npi[], dataset: string, wait: Sleep): Promise<Row[]> {
  const rows: Row[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const response = await post(
      fetchFn,
      `https://openpaymentsdata.cms.gov/api/1/datastore/query/${dataset}/0`,
      {
        conditions: [{ property: NPI, value: npis, operator: "in" }],
        properties: [NPI, PAYER, { alias: "total", expression: { operator: "sum", operands: [AMOUNT] } }],
        groupings: [NPI, PAYER],
        limit: PAGE,
        offset,
        count: false,
        results: true,
        schema: false,
        keys: true,
      },
      wait,
    );
    if (response.status === 403) {
      throw new Error(
        "Open Payments returned 403: its firewall is refusing requests from this network, usually for a few minutes after too many at once. Try again later.",
      );
    }
    if (!response.ok) throw new Error(`Open Payments returned ${response.status}: ${(await response.text()).slice(0, 200)}`);
    const page = ((await response.json()) as { results?: Row[] }).results ?? [];
    rows.push(...page);
    if (page.length < PAGE) return rows;
  }
}

const round = (n: number) => Math.round(n * 100) / 100;

// Payments for every prescriber in `npis`, keyed by NPI. A prescriber with nothing
// reported gets a zero total.
export async function payments(
  fetchFn: Fetch,
  npis: readonly Npi[],
  years = Object.keys(OPEN_PAYMENTS).map(Number),
  wait: Sleep = sleep,
): Promise<Map<Npi, Payments>> {
  const totals = new Map(npis.map((npi) => [npi, { byYear: Object.fromEntries(years.map((y) => [y, 0])) as Record<number, number>, byPayer: new Map<string, number>() }]));
  if (!npis.length) return new Map();

  for (const year of years) {
    const dataset = OPEN_PAYMENTS[year];
    if (!dataset) throw new Error(`no Open Payments dataset for ${year}`);
    for (const row of await yearTotals(fetchFn, npis, dataset, wait)) {
      const entry = totals.get(row[NPI] as Npi);
      if (!entry) continue;
      const amount = Number(row.total) || 0;
      entry.byYear[year] = (entry.byYear[year] ?? 0) + amount;
      entry.byPayer.set(row[PAYER], (entry.byPayer.get(row[PAYER]) ?? 0) + amount);
    }
  }

  return new Map(
    [...totals].map(([npi, { byYear, byPayer }]) => {
      const top = [...byPayer].sort((a, b) => b[1] - a[1])[0];
      const total = Object.values(byYear).reduce((sum, n) => sum + n, 0);
      const rounded = Object.fromEntries(Object.entries(byYear).map(([y, n]) => [Number(y), round(n)]));
      return [npi, { total: round(total), byYear: rounded, topPayer: top ? top[0] : null }];
    }),
  );
}
