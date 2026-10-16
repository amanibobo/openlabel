import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { dailyMed } from "../src/dailymed.ts";

const SET_ID = "595f437d-2729-40bb-9c62-c8ece1f82780";
const xml = readFileSync(new URL("./fixtures/dupixent-v60.xml", import.meta.url), "utf8");

function fakeDailyMed() {
  const calls: string[] = [];
  const fetch = async (url: string) => {
    calls.push(url);
    if (url.includes("/spls.json")) {
      return Response.json({
        data: [
          { setid: "00000000-0000-0000-0000-000000000001", title: "DUPIXENT PEN (DUPILUMAB)", spl_version: 90, published_date: "x" },
          { setid: "00000000-0000-0000-0000-000000000002", title: "DUPIXENT (DUPILUMAB) [REPACKAGER]", spl_version: 2, published_date: "x" },
          { setid: SET_ID, title: "DUPIXENT (DUPILUMAB) INJECTION", spl_version: 60, published_date: "Aug 07, 2026" },
        ],
      });
    }
    if (url.endsWith("/history.json")) {
      return Response.json({ data: { history: [{ spl_version: 60, published_date: "Aug 07, 2026" }] } });
    }
    if (url.endsWith(`${SET_ID}.xml`)) return new Response(xml);
    return new Response("not found", { status: 404 });
  };
  const client = dailyMed({ fetch, cacheDir: mkdtempSync(join(tmpdir(), "openlabel-")) });
  return { client, calls };
}

describe("dailyMed", () => {
  it("prefers the exact brand, then the most-versioned label", async () => {
    const { client } = fakeDailyMed();
    const label = await client.resolve("dupixent");
    expect(label.setId).toBe(SET_ID);
    expect(label.version).toBe(60);
  });

  it("serves a known version from the cache instead of downloading it again", async () => {
    const { client, calls } = fakeDailyMed();
    await client.label(SET_ID as never);
    await client.label(SET_ID as never);
    expect(calls.filter((url) => url.endsWith(".xml"))).toHaveLength(1);
  });

  it("reports when nothing matches", async () => {
    const fetch = async () => Response.json({ data: [] });
    const client = dailyMed({ fetch, cacheDir: mkdtempSync(join(tmpdir(), "openlabel-")) });
    await expect(client.resolve("nothing")).rejects.toThrow(/no DailyMed label/);
  });
});
