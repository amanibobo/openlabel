import { describe, expect, it } from "vitest";
import { claims, cite } from "../src/index.ts";

describe("lorvexa claims", () => {
  it("have unique ids and boxes inside the ad", () => {
    expect(new Set(claims.map((c) => c.id)).size).toBe(claims.length);
    for (const { box } of claims) {
      expect(box.left + box.width).toBeLessThanOrEqual(100);
      expect(box.top + box.height).toBeLessThanOrEqual(100);
    }
  });

  it("cite a label paragraph or a rule", () => {
    expect(claims.map((c) => cite(c.evidence))).toEqual(["§14.1 ¶3", "§14.1 ¶3", "§14.3 ¶1", "imagery.implied-benefit", "print.isi-present"]);
  });
});
