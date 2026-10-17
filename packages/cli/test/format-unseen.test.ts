import { asNpi, type UnseenResult } from "@openlabel/unseen";
import { describe, expect, it } from "vitest";
import { formatUnseen } from "../src/format-unseen.ts";

const result: UnseenResult = {
  search: { state: "GA", specialty: "Dermatology", drugs: ["Dupilumab"], maxPayments: 100, limit: 5 },
  claimsYear: 2024,
  paymentYears: [2023, 2024, 2025],
  scanned: 80,
  unmatchedDrugs: ["Daratumumab"],
  candidates: [
    {
      npi: asNpi("1952628471"), first: "Justin", last: "Cheeley", city: "Atlanta", specialty: "Dermatology", claims: 1299,
      payments: { total: 0, byYear: {}, topPayer: null },
      location: { credential: "MD", address: "1 Main St", city: "Atlanta", state: "GA", zip: "30303" },
      trials: [],
    },
    {
      npi: asNpi("1598860116"), first: "Laura", last: "Aspey", city: "Atlanta", specialty: "Dermatology", claims: 293,
      payments: { total: 47.45, byYear: {}, topPayer: "Acme" },
      location: null,
      trials: [{ nctId: "NCT07053423", title: "t", facility: "f" }],
    },
  ],
};

describe("formatUnseen", () => {
  const lines = formatUnseen(result, { color: false }).split("\n");

  it("states the search it ran", () => {
    expect(lines[0]).toBe("Dermatology in GA prescribing Dupilumab, at most $100 in industry payments 2023–2025");
  });

  it("lines the table up and right-aligns the numbers", () => {
    const [header, first, second] = lines.slice(2, 5);
    expect(header).toMatch(/^ {2}NPI +Name +Location +Claims 2024 +Payments 2023–2025 +Possible trials$/);
    expect(first).toContain("Justin Cheeley, MD");
    expect(first).toContain("1,299");
    expect(second).toContain("NCT07053423");
    expect(first!.indexOf("1,299") + 5).toBe(second!.indexOf("293") + 3);
  });

  it("says where the data comes from and what it could not find", () => {
    const tail = lines.slice(-3).join("\n");
    expect(tail).toContain("2 shown from 80 top prescribers checked");
    expect(tail).toContain("need checking");
    expect(lines.at(-1)).toContain("No Part D prescribing for Daratumumab");
  });
});
