import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ClaimModel } from "@openlabel/check";
import { parseSpl, type DailyMed } from "@openlabel/label";
import { describe, expect, it } from "vitest";
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
    expect(t.err.join("")).toMatch(/Usage: openlabel check/);
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

describe("pieceText", () => {
  it("reads the text out of an html email", () => {
    const html = "<html><style>p{}</style><body><h1>Live clear.</h1><p>Get back to the life&nbsp;you love.</p></body></html>";
    expect(pieceText("email.html", html)).toBe("Live clear.\nGet back to the life you love.");
  });
});
