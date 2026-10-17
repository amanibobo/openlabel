import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ClaimModel } from "@openlabel/check";
import { parseSpl, type DailyMed } from "@openlabel/label";
import { describe, expect, it } from "vitest";
import type { Search, UnseenResult } from "@openlabel/unseen";
import { pieceText, run } from "../src/run.ts";

const label = parseSpl(readFileSync(new URL("../../label/test/fixtures/dupixent-v60.xml", import.meta.url), "utf8"));
const resolved: (number | undefined)[] = [];
const fakeDailyMed = {
  resolve: async (_query: string, version?: number) => {
    resolved.push(version);
    return label;
  },
} as unknown as DailyMed;
const offlineDailyMed = {
  resolve: async () => {
    throw new Error("fetch failed");
  },
} as unknown as DailyMed;

const model: ClaimModel = {
  extract: async () => [{ text: "Live clear.", kind: "efficacy", query: "IGA 0 or 1" }],
  judge: async ({ candidates }) => ({ verdict: "overstated", evidence: candidates.slice(0, 1).map((s) => s.id), reason: "Too strong." }),
};

function io() {
  const out: string[] = [];
  const err: string[] = [];
  return { out, err, io: { stdout: (t: string) => out.push(t), stderr: (t: string) => err.push(t), color: false } };
}

function pieceFile(contents: string, name = "piece.md"): string {
  const path = join(mkdtempSync(join(tmpdir(), "openlabel-cli-")), name);
  writeFileSync(path, contents);
  return path;
}

describe("run", () => {
  it("exits 64 with usage when the label is missing", async () => {
    const t = io();
    expect(await run(["check", "piece.md"], t.io)).toBe(64);
    expect(t.err.join("")).toMatch(/openlabel check <file> --label/);
  });

  it("exits 64 when the piece file does not exist", async () => {
    const t = io();
    expect(await run(["check", "/nope/missing.md", "--label", "dupixent"], t.io)).toBe(64);
  });

  it("prints a report and returns its exit code", async () => {
    const t = io();
    const code = await run(["check", pieceFile("Live clear."), "--label", "dupixent"], t.io, {
      dailyMed: fakeDailyMed,
      model: () => model,
    });
    expect(code).toBe(2);
    expect(t.out.join("")).toContain("~ overstated   “Live clear.”");
    expect(t.out.join("")).toContain("✗ isi.present");
  });

  it("prints JSON when asked", async () => {
    const t = io();
    await run(["check", pieceFile("Live clear."), "--label", "dupixent", "--json"], t.io, {
      dailyMed: fakeDailyMed,
      model: () => model,
    });
    expect(JSON.parse(t.out.join("")).claims[0].verdict).toBe("overstated");
  });

  it("saves the report next to the piece when asked", async () => {
    const file = pieceFile("Live clear.");
    await run(["check", file, "--label", "dupixent", "--save"], io().io, { dailyMed: fakeDailyMed, model: () => model });
    const saved = JSON.parse(readFileSync(`${file}.check.json`, "utf8"));
    expect(saved.label.version).toBe(60);
    expect(saved.claims[0].evidenceText[0].text).toBeTruthy();
    expect(Date.parse(saved.checkedAt)).not.toBeNaN();
  });

  it("passes a pinned label version through and rejects a bad one", async () => {
    const t = io();
    await run(["check", pieceFile("Live clear."), "--label", "dupixent", "--label-version", "53"], t.io, {
      dailyMed: fakeDailyMed,
      model: () => model,
    });
    expect(resolved.at(-1)).toBe(53);
    expect(await run(["check", pieceFile("x"), "--label", "dupixent", "--label-version", "latest"], io().io)).toBe(64);
  });

  it("exits 69 when the label cannot be fetched", async () => {
    const t = io();
    const code = await run(["check", pieceFile("Live clear."), "--label", "dupixent"], t.io, {
      dailyMed: offlineDailyMed,
      model: () => model,
    });
    expect(code).toBe(69);
    expect(t.err.join("")).toBe("openlabel: fetch failed");
  });
});

describe("choosing a provider", () => {
  it("exits 64 with a plain message when a provider has no model", async () => {
    const t = io();
    expect(await run(["check", pieceFile("Live clear."), "--label", "dupixent", "--provider", "openai"], t.io)).toBe(64);
    expect(t.err.join("")).toBe("openlabel: set a model for openai with --model or OPENLABEL_MODEL");
  });

  it("rejects a provider it does not know", async () => {
    const t = io();
    expect(await run(["unseen", "Georgia dermatologists", "--provider", "mistral"], t.io)).toBe(64);
    expect(t.err.join("")).toMatch(/unknown provider "mistral"/);
  });

  it("keeps skills eval on Claude", async () => {
    const t = io();
    expect(await run(["skills", "eval", "--provider", "openai"], t.io)).toBe(64);
    expect(t.err.join("")).toMatch(/skills eval runs Claude/);
  });

  it("checks with whatever model the provider gives", async () => {
    const llm = {
      name: "test",
      json: async ({ system }: { system: string }) =>
        (system.includes("List every claim")
          ? { claims: [{ text: "Live clear.", kind: "efficacy", query: "IGA 0 or 1" }] }
          : { verdict: "overstated", evidence: ["14.1:12.1"], reason: "Only 38%." }) as never,
    };
    const t = io();
    const code = await run(["check", pieceFile("Live clear."), "--label", "dupixent"], t.io, { dailyMed: fakeDailyMed, llm: () => llm });
    expect(code).toBe(2);
    expect(t.out.join("")).toContain("Only 38%.");
  });
});

describe("run watch", () => {
  it("exits 0 for a library checked against the current label", async () => {
    const file = pieceFile("Live clear.");
    await run(["check", file, "--label", "dupixent", "--save"], io().io, { dailyMed: fakeDailyMed, model: () => model });
    const current = { label: async () => label } as unknown as DailyMed;
    const t = io();
    expect(await run(["watch", join(file, "..")], t.io, { dailyMed: current })).toBe(0);
    expect(t.out.join("")).toContain(`✓ ${file.split("/").at(-1)}  checked against the current label`);
  });

  it("exits 69 when the folder does not exist", async () => {
    expect(await run(["watch", "/no/such/folder"], io().io, { dailyMed: fakeDailyMed })).toBe(69);
  });
});

describe("run skills eval", () => {
  it("evaluates every skill in the plugin and exits 1 when any case fails", async () => {
    const seen: string[] = [];
    const t = io();
    const code = await run(["skills", "eval"], t.io, {
      evaluate: async (skill) => {
        seen.push(skill);
        return { skill, passed: skill === "hcp-sms" ? 0 : 1, total: 1, cases: [] };
      },
    });
    expect(seen).toEqual(["claim-check", "fair-balance", "hcp-sms", "label-diff", "med-info-response"]);
    expect(code).toBe(1);
    expect(t.out.join("")).toContain("4 of 5 cases passed");
  });

  it("runs one skill and one case when asked", async () => {
    const calls: [string, string | undefined][] = [];
    const code = await run(["skills", "eval", "label-diff", "--case", "no-change"], io().io, {
      evaluate: async (skill, only) => (calls.push([skill, only]), { skill, passed: 1, total: 1, cases: [] }),
    });
    expect(calls).toEqual([["label-diff", "no-change"]]);
    expect(code).toBe(0);
  });
});

describe("run skills eval --save", () => {
  it("refuses to save a partial run", async () => {
    const t = io();
    expect(await run(["skills", "eval", "hcp-sms", "--save"], t.io, { evaluate: async () => ({ skill: "x", passed: 1, total: 1, cases: [] }) })).toBe(64);
    expect(t.err.join("")).toContain("--save needs a full run");
  });
});

describe("run search", () => {
  it("prints matching label sentences with citations", async () => {
    const t = io();
    expect(await run(["search", "dupixent", "conjunctivitis", "and", "keratitis", "--limit", "3"], t.io, { dailyMed: fakeDailyMed })).toBe(0);
    const lines = t.out.join("").split("\n");
    expect(lines[0]).toBe("Dupixent (dupilumab) · label v60");
    expect(lines.slice(2)).toHaveLength(3);
    expect(lines[2]).toMatch(/^ {2}§\S+ ¶\d+ {2}.*(conjunctivitis|keratitis)/i);
  });

  it("exits 64 without a question", async () => {
    expect(await run(["search", "dupixent"], io().io)).toBe(64);
  });
});

describe("run diff", () => {
  const v53 = parseSpl(readFileSync(new URL("../../label/test/fixtures/dupixent-v53.xml", import.meta.url), "utf8"));
  const v58 = parseSpl(readFileSync(new URL("../../label/test/fixtures/dupixent-v58.xml", import.meta.url), "utf8"));
  const client = {
    resolve: async () => v58,
    versions: async () => [{ version: 58 }, { version: 53 }],
    label: async (_id: string, version?: number) => (version === 53 ? v53 : v58),
  } as unknown as DailyMed;

  it("compares the current label with the one before it by default", async () => {
    const t = io();
    expect(await run(["diff", "dupixent"], t.io, { dailyMed: client })).toBe(0);
    expect(t.out.join("")).toContain("v53 (2026-02-23) to v58");
    expect(t.out.join("")).toContain("+ DUPIXENT is indicated for the treatment of adult and pediatric patients aged 2 years and older with chronic spontaneous urticaria");
  });

  it("exits 64 for a version that is not a number", async () => {
    expect(await run(["diff", "dupixent", "--from", "old"], io().io, { dailyMed: client })).toBe(64);
  });
});

describe("run unseen", () => {
  const empty = async (search: Search): Promise<UnseenResult> => ({
    search, claimsYear: 2024, paymentYears: [2023, 2024, 2025], candidates: [], unmatchedDrugs: [], scanned: 0,
  });

  it("builds a search from flags without asking the model", async () => {
    const seen: Search[] = [];
    const t = io();
    const code = await run(
      ["unseen", "--state", "ga", "--specialty", "Dermatology", "--drug", "Dupilumab", "--drug", "Tralokinumab", "--max-payments", "0", "--limit", "3"],
      t.io,
      { parseQuery: async () => { throw new Error("should not parse"); }, unseen: async (s) => (seen.push(s), empty(s)) },
    );
    expect(code).toBe(0);
    expect(seen[0]).toEqual({ state: "GA", specialty: "Dermatology", drugs: ["Dupilumab", "Tralokinumab"], maxPayments: 0, limit: 3 });
  });

  it("parses a question and lets a flag override its payment limit", async () => {
    const seen: Search[] = [];
    const parseQuery = async () => ({ state: "MS", specialty: "Endocrinology", drugs: ["Semaglutide"], maxPayments: 100 });
    await run(["unseen", "Delta endocrinologists on GLP-1s", "--max-payments", "500"], io().io, {
      parseQuery,
      unseen: async (s) => (seen.push(s), empty(s)),
    });
    expect(seen[0]).toMatchObject({ state: "MS", drugs: ["Semaglutide"], maxPayments: 500, limit: 10 });
  });

  it("exits 64 with no question and no flags", async () => {
    expect(await run(["unseen"], io().io)).toBe(64);
  });
});

describe("pieceText", () => {
  it("reads the text out of an html email", () => {
    const html = "<html><style>p{}</style><body><h1>Live clear.</h1><p>Get back to the life&nbsp;you love.</p></body></html>";
    expect(pieceText("email.html", html)).toBe("Live clear.\nGet back to the life you love.");
  });
});
