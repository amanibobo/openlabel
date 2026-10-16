import { readFileSync } from "node:fs";
import { parseSpl } from "@openlabel/label";
import { describe, expect, it } from "vitest";
import { retriever, tokenize } from "../src/retrieve.ts";

const label = parseSpl(
  readFileSync(new URL("../../label/test/fixtures/dupixent-v60.xml", import.meta.url), "utf8"),
);
const retrieve = retriever(label);

describe("tokenize", () => {
  it("keeps numbers and percentages and drops filler words", () => {
    expect(tokenize("38% of the patients at Week 16")).toEqual(["38%", "patients", "week", "16"]);
  });
});

describe("retriever on the Dupixent label", () => {
  it("finds the atopic dermatitis endpoint for a clearance claim", () => {
    const hits = retrieve("Clear or almost-clear skin at week 16 in adults with atopic dermatitis", "efficacy");
    expect(hits.slice(0, 5).some((s) => s.section.startsWith("14.1") && /IGA 0/.test(s.text))).toBe(true);
  });

  it("finds a results-table row through its caption", () => {
    const hits = retrieve("Efficacy results at Week 16 in adult subjects with moderate-to-severe AD: 38%", "efficacy");
    expect(hits.map((s) => s.id)).toContain("14.1:12.1");
  });

  it("finds the conjunctivitis warning for an eye safety claim", () => {
    const hits = retrieve("conjunctivitis and keratitis", "safety");
    expect(hits[0]?.section).toMatch(/^(5|6)/);
  });

  it("always shows every indication for an indication claim", () => {
    const hits = retrieve("now approved for adults with hives", "indication");
    const indicationSections = new Set(hits.filter((s) => s.section.startsWith("1.")).map((s) => s.section));
    expect(indicationSections.size).toBeGreaterThanOrEqual(9);
  });

  it("takes at most two rows from any one table", () => {
    const hits = retrieve("IGA 0 or 1 responder Week 16 Week 52", "efficacy");
    const perTable = new Map<string, number>();
    for (const s of hits) if (s.context) perTable.set(s.context, (perTable.get(s.context) ?? 0) + 1);
    expect(Math.max(...perTable.values())).toBeLessThanOrEqual(2);
  });

  it("caps non-indication results at k", () => {
    expect(retrieve("dupixent", "other", 3)).toHaveLength(3);
  });
});
