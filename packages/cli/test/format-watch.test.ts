import type { SavedCheck } from "@openlabel/check";
import type { Sentence, SentenceId, SetId } from "@openlabel/label";
import type { LabelDiff, WatchResult } from "@openlabel/watch";
import { describe, expect, it } from "vitest";
import { formatWatch } from "../src/format-watch.ts";

const before: Sentence = { id: "1.7:1.1" as SentenceId, section: "1.7", paragraph: 1, kind: "prose", text: "Indicated for patients aged 12 years and older." };
const after: Sentence = { ...before, text: "Indicated for patients aged 2 years and older." };
const warning = { section: "5.2", title: "Conjunctivitis", category: "warning" as const, status: "changed" as const, changes: [] };
const indication = { section: "1.7", title: "CSU", category: "indication" as const, status: "changed" as const, changes: [{ kind: "changed" as const, before, after }] };

const diff: LabelDiff = {
  setId: "595f437d-2729-40bb-9c62-c8ece1f82780" as SetId,
  title: "Dupixent (dupilumab)",
  from: { version: 53, effectiveDate: "2026-02-23" },
  to: { version: 60, effectiveDate: "2026-04-22" },
  sections: [indication, warning],
};

const claim = { id: "c1", text: "For CSU from age 12.", kind: "indication" as const, query: "", start: 0, end: 1, verdict: "supported" as const, reason: "", evidence: [before.id], evidenceText: [before] };
const saved = { claims: [claim] } as unknown as SavedCheck;

const result: WatchResult = {
  pieces: [
    {
      file: "/lib/email.html",
      diff,
      impacts: [
        { kind: "cited-sentence-changed", claim, cited: before, change: indication.changes[0]!, section: indication },
        { kind: "safety-information-outdated", section: warning },
      ],
    },
    { file: "/lib/banner.html", diff, impacts: [] },
  ],
  current: [{ file: "/lib/new.txt", saved }],
};

describe("formatWatch", () => {
  const text = formatWatch(result, { color: false, cwd: "/lib" });

  it("summarizes the label change once per version pair", () => {
    expect(text.split("\n").slice(0, 2)).toEqual([
      "Dupixent (dupilumab) · v53 (2026-02-23) to v60 (2026-04-22)",
      "  indication §1.7, warning §5.2",
    ]);
  });

  it("shows each affected claim with what its citation used to say and says now", () => {
    expect(text).toContain("blast radius  1 piece, 1 claim");
    expect(text).toContain("✗ email.html");
    expect(text).toContain("“For CSU from age 12.”  cites §1.7 ¶1, which changed");
    expect(text).toContain("was  Indicated for patients aged 12 years and older.");
    expect(text).toContain("now  Indicated for patients aged 2 years and older.");
    expect(text).toContain("safety information  §5.2 Conjunctivitis changed");
  });

  it("lists untouched and current pieces as fine", () => {
    expect(text).toContain("✓ banner.html  label changed, nothing it relies on did");
    expect(text).toContain("✓ new.txt  checked against the current label");
  });
});
