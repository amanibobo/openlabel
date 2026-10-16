import type { Fetch, TrialMatch } from "./types.ts";

const STATES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado", CT: "Connecticut",
  DE: "Delaware", DC: "District of Columbia", FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois",
  IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
  MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana",
  NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NY: "New York",
  NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania",
  PR: "Puerto Rico", RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota", TN: "Tennessee", TX: "Texas",
  UT: "Utah", VT: "Vermont", VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
};

export function stateName(code: string): string {
  const name = STATES[code.toUpperCase()];
  if (!name) throw new Error(`unknown state: ${code}`);
  return name;
}

type Study = {
  protocolSection: {
    identificationModule: { nctId: string; briefTitle: string };
    contactsLocationsModule?: {
      locations?: { facility?: string; city?: string; state?: string; contacts?: { name?: string }[] }[];
      overallOfficials?: { name?: string }[];
    };
  };
};

const quote = (text: string) => `"${text.replace(/"/g, "")}"`;

// ClinicalTrials.gov has no NPI, so a match means the doctor's name appears on a site in
// their state: in the site's name, or as one of its contacts. It is a lead, not a fact.
export async function trials(
  fetchFn: Fetch,
  person: { first: string; last: string; city: string; state: string },
  since = "2021-01-01",
): Promise<TrialMatch[]> {
  const state = stateName(person.state);
  const full = `${person.first} ${person.last}`;
  const term =
    `((AREA[LocationFacility]${quote(person.last)} AND AREA[LocationCity]${quote(person.city)}) ` +
    `OR AREA[LocationContactName]${quote(full)} OR AREA[OverallOfficialName]${quote(full)}) ` +
    `AND AREA[LocationState]${quote(state)} AND AREA[StartDate]RANGE[${since},MAX]`;
  const params = new URLSearchParams({
    "query.term": term,
    pageSize: "20",
    fields: "NCTId,BriefTitle,LocationFacility,LocationCity,LocationState,LocationContactName,OverallOfficialName",
  });
  const response = await fetchFn(`https://clinicaltrials.gov/api/v2/studies?${params}`);
  if (!response.ok) throw new Error(`ClinicalTrials.gov returned ${response.status}`);
  const { studies } = (await response.json()) as { studies: Study[] };

  const last = person.last.toLowerCase();
  const fullLower = full.toLowerCase();
  const matches: TrialMatch[] = [];
  for (const study of studies) {
    const { identificationModule: id, contactsLocationsModule: where } = study.protocolSection;
    const site = (where?.locations ?? []).find(
      (l) =>
        l.state === state &&
        ((l.facility ?? "").toLowerCase().includes(last) ||
          (l.contacts ?? []).some((c) => (c.name ?? "").toLowerCase().includes(fullLower))),
    );
    const official = (where?.overallOfficials ?? []).some((o) => (o.name ?? "").toLowerCase().includes(fullLower));
    if (site || official) matches.push({ nctId: id.nctId, title: id.briefTitle, facility: site?.facility ?? "overall official" });
  }
  return matches;
}
