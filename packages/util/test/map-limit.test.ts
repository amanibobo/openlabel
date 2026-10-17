import { describe, expect, it } from "vitest";
import { mapLimit } from "../src/index.ts";

const tick = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("mapLimit", () => {
  it("keeps input order even when later items finish first", async () => {
    const result = await mapLimit([30, 5, 15], 3, async (ms) => (await tick(ms), ms));
    expect(result).toEqual([30, 5, 15]);
  });

  it("never runs more than limit at once", async () => {
    let running = 0;
    let peak = 0;
    await mapLimit(Array.from({ length: 10 }, (_, i) => i), 3, async () => {
      peak = Math.max(peak, ++running);
      await tick(5);
      running--;
    });
    expect(peak).toBe(3);
  });

  it("handles an empty list and rejects when a call fails", async () => {
    expect(await mapLimit([], 4, async () => 1)).toEqual([]);
    await expect(mapLimit([1, 2], 2, async (n) => (n === 2 ? Promise.reject(new Error("boom")) : n))).rejects.toThrow("boom");
  });
});
