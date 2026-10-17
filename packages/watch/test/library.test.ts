import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { SavedCheck } from "@openlabel/check";
import { allSentences, memoryDailyMed, parseSpl, type DailyMed, type Label } from "@openlabel/label";
import { describe, expect, it } from "vitest";
import { loadLibrary, watchLibrary } from "../src/library.ts";

const load = (version: number) =>
  parseSpl(readFileSync(new URL(`../../label/test/fixtures/dupixent-v${version}.xml`, import.meta.url), "utf8"));
const v53 = load(53);
const v58 = load(58);

function fakeDailyMed(): { client: DailyMed; fetched: string[] } {
  const fetched: string[] = [];
  const memory = memoryDailyMed([v53, v58]);
  const client: DailyMed = {
    ...memory,
    label: (setId, version) => {
      fetched.push(String(version ?? "current"));
      return memory.label(setId, version);
    },
  };
  return { client, fetched };
}

function savedAgainst(label: Label, claimText: string, sentenceText: RegExp): SavedCheck {
  const cited = [...allSentences(label.sections)].find((s) => sentenceText.test(s.text))!;
  return {
    piece: `${claimText} Important Safety Information: ...`,
    label: { setId: label.setId, version: label.version, title: label.title },
    claims: [
      {
        id: "c1", text: claimText, kind: "indication", query: "", start: 0, end: claimText.length,
        verdict: "supported", reason: "", evidence: [cited.id], evidenceText: [cited],
      },
    ],
    findings: [],
    exitCode: 0,
    checkedAt: "2026-03-01T00:00:00Z",
  };
}

function library(pieces: Record<string, SavedCheck>): string {
  const dir = mkdtempSync(join(tmpdir(), "openlabel-library-"));
  mkdirSync(join(dir, "sms"));
  for (const [name, saved] of Object.entries(pieces)) {
    writeFileSync(join(dir, name), saved.piece);
    writeFileSync(join(dir, `${name}.check.json`), JSON.stringify(saved));
  }
  return dir;
}

describe("watchLibrary", () => {
  it("finds saved checks in nested folders", async () => {
    const dir = library({ "email.html": savedAgainst(v58, "x", /./), "sms/a.txt": savedAgainst(v58, "y", /./) });
    expect((await loadLibrary(dir)).map((p) => p.file.slice(dir.length))).toEqual(["/email.html", "/sms/a.txt"]);
  });

  it("traces a real label change to the approved piece that cited it", async () => {
    const dir = library({
      "old.html": savedAgainst(v53, "For CSU patients 12 and older.", /aged 12 years and older with chronic spontaneous urticaria/),
      "fresh.html": savedAgainst(v58, "For CSU patients 2 and older.", /aged 2 years and older with chronic spontaneous urticaria/),
    });
    const { client, fetched } = fakeDailyMed();
    const result = await watchLibrary(await loadLibrary(dir), client);

    expect(result.current.map((p) => p.file.endsWith("fresh.html"))).toEqual([true]);
    expect(result.pieces).toHaveLength(1);
    const [piece] = result.pieces;
    expect(piece?.diff.from.version).toBe(53);
    expect(piece?.impacts.map((i) => i.kind)).toContain("cited-sentence-changed");
    expect(piece?.impacts.map((i) => i.kind)).toContain("safety-information-outdated");
    expect(fetched.filter((v) => v === "current")).toHaveLength(1);
  });
});
