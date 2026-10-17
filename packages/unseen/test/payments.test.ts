import { describe, expect, it } from "vitest";
import { OPEN_PAYMENTS, payments } from "../src/payments.ts";
import { asNpi } from "../src/types.ts";

const [a, b] = [asNpi("1003808361"), asNpi("1952628471")];
const PAYER = "applicable_manufacturer_or_applicable_gpo_making_payment_name";
const row = (npi: string, payer: string, total: string) => ({ covered_recipient_npi: npi, [PAYER]: payer, total });
const noWait = async () => {};

function server(answer: (dataset: string, body: any) => Response) {
  const requests: { dataset: string; body: any }[] = [];
  const headers: Record<string, string>[] = [];
  let inFlight = 0;
  let peak = 0;
  const fetch = async (url: string, init?: RequestInit) => {
    peak = Math.max(peak, ++inFlight);
    await new Promise((r) => setTimeout(r, 2));
    const dataset = url.split("/query/")[1]!.split("/")[0]!;
    const body = JSON.parse(String(init?.body));
    headers.push(init?.headers as Record<string, string>);
    requests.push({ dataset, body });
    inFlight--;
    return answer(dataset, body);
  };
  return { fetch, requests, headers, peak: () => peak };
}

describe("payments", () => {
  it("totals every prescriber in one grouped request per year, one request at a time", async () => {
    const api = server((dataset) =>
      Response.json({
        results:
          dataset === OPEN_PAYMENTS[2024]
            ? [row(a, "ABBVIE", "17.31"), row(a, "GENZYME", "40.00"), row(a, "GENZYME", "3.02")]
            : dataset === OPEN_PAYMENTS[2025]
              ? [row(a, "ABBVIE", "10")]
              : [],
      }),
    );
    const result = await payments(api.fetch, [a, b], undefined, noWait);

    expect(result.get(a)).toEqual({ total: 70.33, byYear: { 2023: 0, 2024: 60.33, 2025: 10 }, topPayer: "GENZYME" });
    expect(result.get(b)).toEqual({ total: 0, byYear: { 2023: 0, 2024: 0, 2025: 0 }, topPayer: null });
    expect(api.requests).toHaveLength(3);
    expect(api.peak()).toBe(1);
    expect(api.headers[0]?.["user-agent"]).toMatch(/^openlabel\//);
    expect(api.requests[0]?.body).toMatchObject({
      conditions: [{ property: "covered_recipient_npi", value: [a, b], operator: "in" }],
      groupings: ["covered_recipient_npi", PAYER],
      properties: ["covered_recipient_npi", PAYER, { alias: "total", expression: { operator: "sum", operands: ["total_amount_of_payment_usdollars"] } }],
    });
  });

  it("pages through a year with more grouped rows than fit in one response", async () => {
    const api = server((_dataset, body) =>
      Response.json({ results: Array.from({ length: body.offset === 0 ? 500 : 3 }, () => row(a, "ACME", "1")) }),
    );
    const result = await payments(api.fetch, [a], [2024], noWait);
    expect(api.requests.map((r) => r.body.offset)).toEqual([0, 500]);
    expect(result.get(a)?.total).toBe(503);
  });

  it("retries a refused request after a pause and then succeeds", async () => {
    const waits: number[] = [];
    let calls = 0;
    const fetch = async () => (++calls <= 2 ? new Response("blocked", { status: 403 }) : Response.json({ results: [] }));
    await payments(fetch, [a], [2024], async (ms) => void waits.push(ms));
    expect(waits).toEqual([2000, 5000]);
  });

  it("explains a 403 that outlasts the retries", async () => {
    const fetch = async () => new Response("blocked", { status: 403 });
    await expect(payments(fetch, [a], [2024], noWait)).rejects.toThrow(/firewall is refusing requests from this network/);
  });

  it("does not retry a request the server rejected as bad", async () => {
    let calls = 0;
    const fetch = async () => (calls++, new Response("bad query", { status: 400 }));
    await expect(payments(fetch, [a], [2024], noWait)).rejects.toThrow("Open Payments returned 400: bad query");
    expect(calls).toBe(1);
  });

  it("asks for nothing when there is no one to look up", async () => {
    const api = server(() => Response.json({ results: [] }));
    expect(await payments(api.fetch, [], undefined, noWait)).toEqual(new Map());
    expect(api.requests).toHaveLength(0);
  });
});
