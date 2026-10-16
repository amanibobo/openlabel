import { readFileSync } from "node:fs";
import { parseSpl } from "@openlabel/label";
import { describe, expect, it } from "vitest";
import { diffLabels, type SectionChange } from "../src/diff.ts";

const load = (version: number) =>
  parseSpl(readFileSync(new URL(`../../label/test/fixtures/dupixent-v${version}.xml`, import.meta.url), "utf8"));

const diff = diffLabels(load(53), load(58));
const section = (key: string): SectionChange | undefined => diff.sections.find((s) => s.section === key);
const afterText = (s: SectionChange | undefined) =>
  (s?.changes ?? []).flatMap((c) => (c.kind === "removed" ? [] : [c.after.text])).join(" ");

describe("Dupixent, February to July 2026", () => {
  it("catches the urticaria indication widening to age 2", () => {
    expect(section("1.7")?.category).toBe("indication");
    expect(afterText(section("1.7"))).toMatch(/aged 2 years and older with chronic spontaneous urticaria/);
  });

  it("catches the new blindness language in the eye warning", () => {
    expect(section("5.2")?.category).toBe("warning");
    expect(afterText(section("5.2"))).toMatch(/blindness/);
  });

  it("ignores sections whose only change is table numbering", () => {
    expect(section("14.2")).toBeUndefined();
  });

  it("finds no change between versions that share an effective date", () => {
    expect(diffLabels(load(58), load(60)).sections).toEqual([]);
  });
});
