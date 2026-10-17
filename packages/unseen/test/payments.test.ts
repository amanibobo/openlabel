import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { OPEN_PAYMENTS, payments } from "../src/payments.ts";
import { asNpi } from "../src/types.ts";

const page2024 = JSON.parse(readFileSync(new URL("./fixtures/payments-2024-1003808361.json", import.meta.url), "utf8"));

describe("payments", () => {
  it("totals a prescriber's payments per year and names the biggest payer", async () => {
    const fetch = async (url: string) =>
      Response.json(url.includes(OPEN_PAYMENTS[2024]!) ? page2024 : { count: 0, results: [] });
    const result = await payments(fetch, asNpi("1003808361"));

    expect(result.byYear).toEqual({ 2023: 0, 2024: 4450.47, 2025: 0 });
    expect(result.total).toBe(4450.47);
    expect(result.topPayer).toBeTruthy();
  });

  it("pages through prescribers with more than one page of payments", async () => {
    const offsets: string[] = [];
    const fetch = async (url: string) => {
      const offset = new URL(url).searchParams.get("offset")!;
      offsets.push(offset);
      const rows = Array.from({ length: offset === "0" ? 500 : 20 }, () => ({
        total_amount_of_payment_usdollars: "1.00",
        applicable_manufacturer_or_applicable_gpo_making_payment_name: "Acme",
      }));
      return Response.json({ count: 520, results: rows });
    };
    const result = await payments(fetch, asNpi("1003808361"), [2024]);
    expect(offsets).toEqual(["0", "500"]);
    expect(result).toEqual({ total: 520, byYear: { 2024: 520 }, topPayer: "Acme" });
  });

  it("reports nothing for someone with no payments", async () => {
    const fetch = async () => Response.json({ count: 0, results: [] });
    expect(await payments(fetch, asNpi("1003808361"))).toEqual({ total: 0, byYear: { 2023: 0, 2024: 0, 2025: 0 }, topPayer: null });
  });
});
