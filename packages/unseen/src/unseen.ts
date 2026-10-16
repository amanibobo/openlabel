import { location } from "./nppes.ts";
import { PART_D, prescribers } from "./partd.ts";
import { OPEN_PAYMENTS, payments } from "./payments.ts";
import { trials } from "./trials.ts";
import type { Candidate, Fetch, Search, UnseenResult } from "./types.ts";

async function mapLimit<T, R>(items: readonly T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      for (let i = next++; i < items.length; i = next++) results[i] = await fn(items[i] as T);
    }),
  );
  return results;
}

export async function unseen(search: Search, options: { fetch?: Fetch; concurrency?: number } = {}): Promise<UnseenResult> {
  const fetchFn = options.fetch ?? ((url) => fetch(url));
  const concurrency = options.concurrency ?? 8;
  const ranked = await prescribers(fetchFn, search);

  // Payments are the expensive join, so walk the ranking in batches and stop once enough pass.
  const kept: Candidate[] = [];
  let scanned = 0;
  while (kept.length < search.limit && scanned < ranked.length) {
    const batch = ranked.slice(scanned, scanned + search.limit * 2);
    scanned += batch.length;
    const paid = await mapLimit(batch, concurrency, async (p) => ({ ...p, payments: await payments(fetchFn, p.npi) }));
    for (const p of paid) {
      if (search.maxPayments !== null && p.payments.total > search.maxPayments) continue;
      if (kept.length < search.limit) kept.push({ ...p, location: null, trials: [] });
    }
  }

  const candidates = await mapLimit(kept, concurrency, async (c) => {
    const where = await location(fetchFn, c.npi);
    const matched = await trials(fetchFn, { first: c.first, last: c.last, city: where?.city ?? c.city, state: search.state });
    return { ...c, location: where, trials: matched };
  });

  return { search, claimsYear: PART_D.year, paymentYears: Object.keys(OPEN_PAYMENTS).map(Number), candidates, scanned };
}
