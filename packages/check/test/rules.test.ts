import { describe, expect, it } from "vitest";
import { FDA_CORE, loadPack, runRules } from "../src/rules.ts";
import type { CheckedClaim } from "../src/types.ts";

function claim(text: string, piece: string, verdict: CheckedClaim["verdict"]): CheckedClaim {
  const start = piece.indexOf(text);
  return { id: "c", text, kind: "efficacy", start, end: start + text.length, verdict, evidence: [], reason: "", evidenceText: [] };
}

describe("loadPack", () => {
  it("reads a team pack and inherits fda-core when asked", () => {
    const pack = loadPack(`
pack: pulse-sms
extends: fda-core
rules:
  - id: sms.length
    type: max-length
    max: 160
`);
    expect(pack.rules.map((r) => r.id)).toEqual(["isi.present", "claims.superlatives", "sms.length"]);
  });

  it("rejects a rule it does not understand", () => {
    expect(() => loadPack("pack: x\nrules:\n  - id: y\n    type: vibes\n")).toThrow();
  });
});

describe("runRules", () => {
  it("flags a piece with no safety information", () => {
    const findings = runRules(FDA_CORE, "Live clear.", []);
    expect(findings.map((f) => [f.rule, f.severity])).toEqual([["isi.present", "violation"]]);
  });

  it("accepts a piece that carries its safety information", () => {
    expect(runRules(FDA_CORE, "Live clear. Important Safety Information: ...", [])).toEqual([]);
  });

  it("flags a superlative unless the claim around it was judged supported", () => {
    const piece = "The only biologic with these results. Important Safety Information below.";
    const flagged = runRules(FDA_CORE, piece, [claim("The only biologic with these results.", piece, "overstated")]);
    expect(flagged.map((f) => f.rule)).toEqual(["claims.superlatives"]);
    const allowed = runRules(FDA_CORE, piece, [claim("The only biologic with these results.", piece, "supported")]);
    expect(allowed).toEqual([]);
  });

  it("enforces a length limit", () => {
    const pack = loadPack("pack: sms\nrules:\n  - id: sms.length\n    type: max-length\n    max: 10\n");
    expect(runRules(pack, "This text is too long.", [])[0]?.message).toMatch(/22 characters, over the 10 limit/);
  });
});
