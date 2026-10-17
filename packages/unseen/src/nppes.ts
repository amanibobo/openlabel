import type { Fetch, Location, Npi } from "./types.ts";

type Result = {
  basic: { credential?: string };
  addresses: { address_purpose: string; address_1: string; city: string; state: string; postal_code: string }[];
};

function title(text: string): string {
  return text.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

export async function location(fetchFn: Fetch, npi: Npi): Promise<Location | null> {
  const response = await fetchFn(`https://npiregistry.cms.hhs.gov/api/?version=2.1&number=${npi}`);
  if (!response.ok) throw new Error(`NPPES returned ${response.status}`);
  const body = (await response.json()) as { results?: Result[] };
  const result = body.results?.[0];
  const practice = result?.addresses.find((a) => a.address_purpose === "LOCATION");
  if (!result || !practice) return null;
  return {
    credential: result.basic.credential?.replace(/\./g, "") || null,
    address: title(practice.address_1),
    city: title(practice.city),
    state: practice.state,
    zip: practice.postal_code.slice(0, 5),
  };
}
