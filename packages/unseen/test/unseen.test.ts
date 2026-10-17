import { describe, expect, it } from "vitest";
import { unseen } from "../src/unseen.ts";

const doctors = [
  { npi: "1000000001", last: "Paid", claims: "900", payments: "250.00" },
  { npi: "1000000002", last: "Quiet", claims: "800", payments: "0" },
  { npi: "1000000003", last: "Small", claims: "700", payments: "40.00" },
  { npi: "1000000004", last: "Later", claims: "100", payments: "0" },
];

function fakeApis() {
  const calls: string[] = [];
  const fetch = async (url: string, init?: RequestInit) => {
    calls.push(url);
    const u = new URL(url);
    if (u.host === "data.cms.gov") {
      return Response.json(
        doctors.map((d) => ({
          Prscrbr_NPI: d.npi, Prscrbr_First_Name: "Ann", Prscrbr_Last_Org_Name: d.last,
          Prscrbr_City: "Valdosta", Prscrbr_Type: "Dermatology", Tot_Clms: d.claims,
        })),
      );
    }
    if (u.host === "openpaymentsdata.cms.gov") {
      const asked: string[] = JSON.parse(String(init?.body)).conditions[0].value;
      const paidIn2024 = url.includes("e6b17c6a");
      const results = doctors
        .filter((d) => asked.includes(d.npi) && paidIn2024 && d.payments !== "0")
        .map((d) => ({ covered_recipient_npi: d.npi, applicable_manufacturer_or_applicable_gpo_making_payment_name: "Acme", total: d.payments }));
      return Response.json({ results });
    }
    if (u.host === "npiregistry.cms.hhs.gov") {
      return Response.json({
        results: [{ basic: { credential: "M.D." }, addresses: [{ address_purpose: "LOCATION", address_1: "1 MAIN ST", city: "VALDOSTA", state: "GA", postal_code: "316010000" }] }],
      });
    }
    return Response.json({ studies: [] });
  };
  return { fetch, calls };
}

describe("unseen", () => {
  it("keeps high prescribers under the payment limit, in claims order", async () => {
    const { fetch } = fakeApis();
    const result = await unseen(
      { state: "GA", specialty: "Dermatology", drugs: ["Dupilumab"], maxPayments: 100, limit: 2 },
      { fetch },
    );
    expect(result.candidates.map((c) => [c.last, c.payments.total])).toEqual([["Quiet", 0], ["Small", 40]]);
    expect(result.candidates[0]?.location).toMatchObject({ credential: "MD", city: "Valdosta", zip: "31601" });
    expect(result).toMatchObject({ claimsYear: 2024, paymentYears: [2023, 2024, 2025] });
  });

  it("looks up payments for the whole batch in one request per year", async () => {
    const { fetch, calls } = fakeApis();
    const result = await unseen(
      { state: "GA", specialty: "Dermatology", drugs: ["Dupilumab"], maxPayments: null, limit: 1 },
      { fetch },
    );
    expect(calls.filter((u) => u.includes("openpaymentsdata"))).toHaveLength(3);
    expect(result.scanned).toBe(4);
    expect(result.candidates.map((c) => c.last)).toEqual(["Paid"]);
  });
});
