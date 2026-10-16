import { readFile, writeFile } from "node:fs/promises";
import { extname } from "node:path";
import { parseArgs } from "node:util";
import { check, claudeModel, FDA_CORE, loadPack, sidecarPath, type ClaimModel, type SavedCheck } from "@openlabel/check";
import { dailyMed, type DailyMed } from "@openlabel/label";
import { formatReport } from "./format.ts";

export const USAGE = `Usage: openlabel check <file> --label <drug name or DailyMed set id> [options]

Options:
  --rules <file>         a YAML rule pack (defaults to fda-core)
  --label-version <n>    check against a past label version instead of the current one
  --json                 print the report as JSON
  --save                 write the report next to the piece (<file>.check.json) for watch
  --model <id>           Claude model to use (default claude-opus-5-5)
  -h, --help             show this help

Exit codes: 0 all supported, 1 overstated or warning, 2 off-label, unsupported or violation,
64 usage error, 69 the check could not run (network or API).`;

export type Io = {
  stdout: (text: string) => void;
  stderr: (text: string) => void;
  color: boolean;
};

export type Deps = {
  dailyMed?: DailyMed;
  model?: (id: string | undefined) => ClaimModel;
};

export function pieceText(file: string, raw: string): string {
  if (![".html", ".htm"].includes(extname(file).toLowerCase())) return raw;
  return raw
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>|<\/(p|div|li|h[1-6]|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&rsquo;/g, "'")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

export async function run(argv: string[], io: Io, deps: Deps = {}): Promise<number> {
  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        label: { type: "string" },
        "label-version": { type: "string" },
        rules: { type: "string" },
        json: { type: "boolean", default: false },
        save: { type: "boolean", default: false },
        model: { type: "string" },
        help: { type: "boolean", short: "h", default: false },
      },
    });
  } catch (error) {
    io.stderr(`${(error as Error).message}\n\n${USAGE}`);
    return 64;
  }

  const { values, positionals } = parsed;
  if (values.help) {
    io.stdout(USAGE);
    return 0;
  }
  const [command, file] = positionals;
  if (command !== "check" || !file || !values.label) {
    io.stderr(USAGE);
    return 64;
  }

  const labelVersion = values["label-version"] === undefined ? undefined : Number(values["label-version"]);
  if (labelVersion !== undefined && !Number.isInteger(labelVersion)) {
    io.stderr(`openlabel: --label-version must be a whole number\n\n${USAGE}`);
    return 64;
  }

  let piece: string;
  let pack = FDA_CORE;
  try {
    piece = pieceText(file, await readFile(file, "utf8"));
    if (values.rules) pack = loadPack(await readFile(values.rules, "utf8"));
  } catch (error) {
    io.stderr(`openlabel: ${(error as Error).message}`);
    return 64;
  }

  try {
    const label = await (deps.dailyMed ?? dailyMed()).resolve(values.label, labelVersion);
    const model = (deps.model ?? ((id) => claudeModel(id ? { model: id } : {})))(values.model);
    const report = await check({ piece, label, model, pack });
    if (values.save) {
      const saved: SavedCheck = { ...report, checkedAt: new Date().toISOString() };
      await writeFile(sidecarPath(file), `${JSON.stringify(saved, null, 2)}\n`);
    }
    io.stdout(values.json ? JSON.stringify(report, null, 2) : formatReport(report, { color: io.color }));
    return report.exitCode;
  } catch (error) {
    io.stderr(`openlabel: ${(error as Error).message}`);
    return 69;
  }
}
