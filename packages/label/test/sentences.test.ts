import { describe, expect, it } from "vitest";
import { splitSentences } from "../src/sentences.ts";

describe("splitSentences", () => {
  it("splits ordinary prose", () => {
    expect(splitSentences("Avoid use of live vaccines. Complete all vaccinations before starting treatment.")).toEqual([
      "Avoid use of live vaccines.",
      "Complete all vaccinations before starting treatment.",
    ]);
  });

  it("keeps abbreviations and decimals inside a sentence", () => {
    const text =
      "Patients received 0.5 mg/kg (approx. 300 mg) vs. placebo, e.g. in Trial 1, as reported in the U.S. population. Results follow.";
    expect(splitSentences(text)).toEqual([
      "Patients received 0.5 mg/kg (approx. 300 mg) vs. placebo, e.g. in Trial 1, as reported in the U.S. population.",
      "Results follow.",
    ]);
  });

  it("keeps bracketed cross references attached", () => {
    expect(
      splitSentences("Discontinue if anaphylaxis occurs [see Warnings and Precautions (5.1)]. Monitor patients."),
    ).toEqual(["Discontinue if anaphylaxis occurs [see Warnings and Precautions (5.1)].", "Monitor patients."]);
  });

  it("splits before a sentence that starts with a number", () => {
    expect(splitSentences("The primary endpoint was IGA 0 or 1. 38% of patients responded.")).toEqual([
      "The primary endpoint was IGA 0 or 1.",
      "38% of patients responded.",
    ]);
  });

  it("collapses whitespace and drops empty input", () => {
    expect(splitSentences("  Line one\n   continues.  ")).toEqual(["Line one continues."]);
    expect(splitSentences("   ")).toEqual([]);
  });
});
