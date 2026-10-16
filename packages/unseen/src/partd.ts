import { asNpi, type Fetch, type Prescriber, type Search } from "./types.ts";

// Medicare Part D Prescribers by Provider and Drug, data year 2024 (published May 2026).
export const PART_D = { year: 2024, dataset: "9552739e-3d05-4c1b-8eff-ecabf391e2e5" };

type Row = {
  Prscrbr_NPI: string;
  Prscrbr_Last_Org_Name: string;
  Prscrbr_First_Name: string;
  Prscrbr_City: string;
  Prscrbr_Type: string;
  Tot_Clms: string;
};

const PAGE = 1000;

function title(text: string): string {
  return text.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

export async function prescribers(
  fetchFn: Fetch,
  search: Pick<Search, "state" | "specialty" | "drugs">,
): Promise<{ prescribers: Prescriber[]; unmatchedDrugs: string[] }> {
  const byNpi = new Map<string, Prescriber>();
  const unmatchedDrugs: string[] = [];
  for (const drug of search.drugs) {
    for (let offset = 0; ; offset += PAGE) {
      const params = new URLSearchParams({
        size: String(PAGE),
        offset: String(offset),
        "filter[Prscrbr_State_Abrvtn]": search.state,
        "filter[Gnrc_Name]": drug,
        "filter[Prscrbr_Type]": search.specialty,
      });
      const response = await fetchFn(`https://data.cms.gov/data-api/v1/dataset/${PART_D.dataset}/data?${params}`);
      if (!response.ok) throw new Error(`CMS Part D returned ${response.status}`);
      const rows = (await response.json()) as Row[];
      if (offset === 0 && rows.length === 0) unmatchedDrugs.push(drug);
      for (const row of rows) {
        // One row per brand form ("Dupixent Pen", "Dupixent Syringe"); a prescriber is the sum.
        const existing = byNpi.get(row.Prscrbr_NPI);
        const claims = Number(row.Tot_Clms) || 0;
        if (existing) existing.claims += claims;
        else
          byNpi.set(row.Prscrbr_NPI, {
            npi: asNpi(row.Prscrbr_NPI),
            first: title(row.Prscrbr_First_Name),
            last: title(row.Prscrbr_Last_Org_Name),
            city: title(row.Prscrbr_City),
            specialty: row.Prscrbr_Type,
            claims,
          });
      }
      if (rows.length < PAGE) break;
    }
  }
  return { prescribers: [...byNpi.values()].sort((a, b) => b.claims - a.claims), unmatchedDrugs };
}
