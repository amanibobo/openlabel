import { readFileSync } from "node:fs";
import type { ClaimModel } from "@openlabel/check";
import { memoryDailyMed, parseSpl } from "@openlabel/label";
import { describe, expect, it } from "vitest";
import { openLabelTools } from "../src/tools.ts";

const load = (v: number) =>
  parseSpl(readFileSync(new URL(`../../label/test/fixtures/dupixent-v${v}.xml`, import.meta.url), "utf8"));
const [v53, v58] = [load(53), load(58)];

const dailyMed = memoryDailyMed([v53, v58]);

const model: ClaimModel = {
  extract: async () => [{ text: "Live clear.", kind: "efficacy", query: "IGA 0 or 1" }],
  judge: async ({ candidates }) => ({ verdict: "overstated", evidence: [candidates[0]!.id], reason: "Too strong." }),
};

const tools = openLabelTools({ dailyMed, model, packs: { sms: "pack: sms\nrules:\n  - id: sms.length\n    type: max-length\n    max: 5\n" } });

describe("openLabelTools", () => {
  it("check returns verdicts with cited label text and runs a named pack", async () => {
    const result = JSON.parse(await tools.check({ piece: "Live clear.", drug: "dupixent", rules: "sms" }));
    expect(result.claims[0]).toMatchObject({ text: "Live clear.", verdict: "overstated" });
    expect(result.claims[0].evidence[0].cite).toMatch(/^§\S+ ¶\d+$/);
    expect(result.findings.map((f: { rule: string }) => f.rule)).toEqual(["sms.length"]);
  });

  it("check refuses a pack it does not know", async () => {
    await expect(tools.check({ piece: "x", drug: "dupixent", rules: "nope" })).rejects.toThrow(/unknown rule pack nope; available: sms/);
  });

  it("search returns cited sentences", async () => {
    const result = JSON.parse(await tools.search({ drug: "dupixent", question: "conjunctivitis keratitis", limit: 2 }));
    expect(result.sentences).toHaveLength(2);
    expect(result.sentences[0].text.toLowerCase()).toMatch(/conjunctivitis|keratitis/);
  });

  it("diff defaults to the previous version and returns before and after text", async () => {
    const result = JSON.parse(await tools.diff({ drug: "dupixent" }));
    expect([result.from.version, result.to.version]).toEqual([53, 58]);
    const indication = result.sections.find((s: { section: string }) => s.section === "1.7");
    expect(indication.changes[0].after).toMatch(/aged 2 years and older/);
  });

  it("diff names the drug when it has no earlier version", async () => {
    const single = openLabelTools({ dailyMed: memoryDailyMed([v53]), model });
    await expect(single.diff({ drug: "dupixent" })).rejects.toThrow("Dupixent (dupilumab) has no earlier version on DailyMed");
  });
});
