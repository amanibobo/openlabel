import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { prescribers } from "../src/partd.ts";

const rows = JSON.parse(readFileSync(new URL("./fixtures/partd-ga-dupilumab-derm.json", import.meta.url), "utf8")) as {
  Prscrbr_NPI: string;
  Tot_Clms: string;
}[];

describe("prescribers", () => {
  it("sums brand forms into one prescriber and ranks by claims", async () => {
    const urls: string[] = [];
    const fetch = async (url: string) => {
      urls.push(url);
      return Response.json(rows);
    };
    const result = await prescribers(fetch, { state: "GA", specialty: "Dermatology", drugs: ["Dupilumab"] });

    expect(result).toHaveLength(new Set(rows.map((r) => r.Prscrbr_NPI)).size);
    const expected = rows.filter((r) => r.Prscrbr_NPI === "1003808361").reduce((sum, r) => sum + Number(r.Tot_Clms), 0);
    expect(result.find((p) => p.npi === "1003808361")?.claims).toBe(expected);
    expect(result.map((p) => p.claims)).toEqual([...result.map((p) => p.claims)].sort((a, b) => b - a));
    expect(result.find((p) => p.npi === "1003808361")).toMatchObject({ name: "Charles Douchy", city: "Duluth" });
    expect(decodeURIComponent(urls[0]!)).toContain("filter[Gnrc_Name]=Dupilumab");
  });

  it("keeps paging until a short page comes back", async () => {
    let calls = 0;
    const fetch = async () => {
      calls += 1;
      const page = Array.from({ length: calls === 1 ? 1000 : 3 }, (_, i) => ({
        Prscrbr_NPI: String(1000000000 + calls * 10000 + i),
        Prscrbr_Last_Org_Name: "A",
        Prscrbr_First_Name: "B",
        Prscrbr_City: "C",
        Prscrbr_Type: "Dermatology",
        Tot_Clms: "1",
      }));
      return Response.json(page);
    };
    const result = await prescribers(fetch, { state: "GA", specialty: "Dermatology", drugs: ["Dupilumab"] });
    expect(calls).toBe(2);
    expect(result).toHaveLength(1003);
  });
});
