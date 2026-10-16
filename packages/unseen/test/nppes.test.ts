import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { location } from "../src/nppes.ts";
import { asNpi } from "../src/types.ts";

const body = readFileSync(new URL("./fixtures/nppes-1003808361.json", import.meta.url), "utf8");

describe("location", () => {
  it("reads the practice address, not the mailing address", async () => {
    const result = await location(async () => new Response(body), asNpi("1003808361"));
    expect(result).toMatchObject({ credential: "MD", city: "Duluth", state: "GA" });
    expect(result?.zip).toMatch(/^\d{5}$/);
  });

  it("returns null for an NPI the registry does not know", async () => {
    expect(await location(async () => Response.json({ result_count: 0, results: [] }), asNpi("1000000000"))).toBeNull();
  });
});
