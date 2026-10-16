export type Npi = string & { readonly __brand: "Npi" };

export function asNpi(value: string): Npi {
  if (!/^\d{10}$/.test(value)) throw new Error(`not an NPI: ${value}`);
  return value as Npi;
}

export type Fetch = (url: string) => Promise<Response>;

export type Search = {
  state: string;
  // CMS's own specialty label, as it appears in Part D ("Dermatology", "Endocrinology").
  specialty: string;
  // Generic names as CMS spells them ("Dupilumab", "Semaglutide").
  drugs: string[];
  // Upper bound on industry payments over the payment years; null means no limit.
  maxPayments: number | null;
  limit: number;
};

export type Prescriber = {
  npi: Npi;
  name: string;
  city: string;
  specialty: string;
  claims: number;
};

export type Payments = { total: number; byYear: Record<number, number>; topPayer: string | null };

export type Location = { credential: string | null; address: string; city: string; state: string; zip: string };

export type TrialMatch = { nctId: string; title: string; facility: string };

export type Candidate = Prescriber & { payments: Payments; location: Location | null; trials: TrialMatch[] };

export type UnseenResult = {
  search: Search;
  claimsYear: number;
  paymentYears: number[];
  candidates: Candidate[];
  // Prescribers ranked out before the payment filter, so a reader knows how wide the net was.
  scanned: number;
};
