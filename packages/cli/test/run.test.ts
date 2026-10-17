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
