import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { stateName, trials } from "../src/trials.ts";

const body = readFileSync(new URL("./fixtures/trials-kavtaradze.json", import.meta.url), "utf8");

describe("trials", () => {
  it("keeps studies with a site in the doctor's state that carries their name", async () => {
    let term = "";
    const fetch = async (url: string) => {
      term = new URL(url).searchParams.get("query.term")!;
      return new Response(body);
    };
    const matches = await trials(fetch, { first: "David", last: "Kavtaradze", city: "Cordele", state: "GA" });

    expect(term).toContain('AREA[LocationState]"Georgia"');
    expect(matches.map((m) => m.nctId)).toContain("NCT07053423");
    expect(matches.find((m) => m.nctId === "NCT07053423")?.facility).toMatch(/Dr\. David Kavtaradze/);
  });

  it("drops a study whose only same-named site is in another state", async () => {
    const study = {
      protocolSection: {
        identificationModule: { nctId: "NCT00000001", briefTitle: "t" },
        contactsLocationsModule: { locations: [{ facility: "Kavtaradze Clinic", city: "Austin", state: "Texas" }] },
      },
    };
    const matches = await trials(async () => Response.json({ studies: [study] }), {
      first: "David",
      last: "Kavtaradze",
      city: "Cordele",
      state: "GA",
    });
    expect(matches).toEqual([]);
  });

  it("names states and rejects unknown codes", () => {
    expect(stateName("nm")).toBe("New Mexico");
    expect(() => stateName("ZZ")).toThrow(/unknown state/);
  });
});
