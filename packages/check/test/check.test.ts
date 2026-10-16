import { readFileSync } from "node:fs";
import { parseSpl } from "@openlabel/label";
import { describe, expect, it } from "vitest";
import { check, locate } from "../src/check.ts";
import type { ClaimModel, ExtractedClaim, RawJudgment } from "../src/model.ts";

const label = parseSpl(
  readFileSync(new URL("../../label/test/fixtures/dupixent-v60.xml", import.meta.url), "utf8"),
);

function scripted(claims: ExtractedClaim[], judge: (claim: string, shown: string[]) => RawJudgment): ClaimModel {
  return {
    extract: async () => claims,
    judge: async ({ claim, candidates }) => judge(claim, candidates.map((s) => s.id)),
  };
}

const PIECE = "Clear or almost-clear skin at week 16.\nNow approved for  chronic hives in toddlers. Important Safety Information follows.";

describe("locate", () => {
  it("finds a quote even when spacing or case differ", () => {
    expect(locate(PIECE, "now approved for chronic hives")).toEqual({ start: 39, end: 70 });
    expect(locate(PIECE, "something the piece never says")).toBeNull();
  });
});

describe("check", () => {
  it("drops claims the model invented and keeps the real ones in order", async () => {
    const model = scripted(
      [
        { text: "Now approved for chronic hives in toddlers.", kind: "indication" },
        { text: "Works in one day.", kind: "efficacy" },
        { text: "Clear or almost-clear skin at week 16.", kind: "efficacy" },
      ],
      (_claim, shown) => ({ verdict: "supported", evidence: shown.slice(0, 1), reason: "r" }),
    );
    const report = await check({ piece: PIECE, label, model });
    expect(report.claims.map((c) => c.text)).toEqual([
      "Clear or almost-clear skin at week 16.",
      "Now approved for  chronic hives in toddlers.",
    ]);
  });

  it("ignores citations to sentences the model was not shown", async () => {
    const model = scripted([{ text: "Clear or almost-clear skin at week 16.", kind: "efficacy" }], () => ({
      verdict: "supported",
      evidence: ["99.9:1.1"],
      reason: "made up",
    }));
    const [claim] = (await check({ piece: PIECE, label, model })).claims;
    expect(claim?.evidence).toEqual([]);
    expect(claim?.verdict).toBe("unsupported");
  });

  it("keeps cited evidence text and sets the exit code from verdicts and rules", async () => {
    const model = scripted(
      [
        { text: "Clear or almost-clear skin at week 16.", kind: "efficacy" },
        { text: "Now approved for chronic hives in toddlers.", kind: "indication" },
      ],
      (claim, shown) =>
        claim.includes("toddlers")
          ? { verdict: "off-label", evidence: shown.filter((id) => id.startsWith("1.7")), reason: "CSU is for 12 and older." }
          : { verdict: "supported", evidence: shown.slice(0, 1), reason: "Matches §14.1." },
    );
    const report = await check({ piece: PIECE, label, model });
    expect(report.claims.map((c) => c.verdict)).toEqual(["supported", "off-label"]);
    expect(report.claims[1]?.evidenceText.every((s) => s.section === "1.7")).toBe(true);
    expect(report.findings).toEqual([]);
    expect(report.exitCode).toBe(2);
  });
});
