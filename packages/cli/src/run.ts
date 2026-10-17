import { readFile, writeFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { check, claimModel, FDA_CORE, loadPack, retriever, sidecarPath, type ClaimModel, type Progress, type SavedCheck } from "@openlabel/check";
import { cite, dailyMed, type DailyMed } from "@openlabel/label";
import { DEFAULT_ANTHROPIC_MODEL, llmFromEnv, type Llm } from "@openlabel/llm";
import { queryParser, unseen, type ParseQuery, type Search, type UnseenResult } from "@openlabel/unseen";
import { diffDrugLabel, loadLibrary, watchLibrary } from "@openlabel/watch";
import { claudeEvaluator, listSkills, RESULTS_FILE, summarize, type SkillResult } from "@openlabel/skills";
import { formatDiff } from "./format-diff.ts";
import { formatSkills } from "./format-skills.ts";
import { formatReport } from "./format.ts";
import { formatUnseen } from "./format-unseen.ts";
import { formatWatch } from "./format-watch.ts";

export const USAGE = `Usage:
  openlabel check <file> --label <drug name or DailyMed set id> [options]
  openlabel watch [folder]
  openlabel diff <drug> [--from <version>] [--to <version>]
  openlabel search <drug> "<question>" [--limit n]
  openlabel skills eval [skill] [--case <id>] [--save]
  openlabel unseen "<question>"   or   openlabel unseen --state GA --specialty Dermatology --drug Dupilumab

unseen ranks a specialty's Medicare Part D prescribers of a drug in a state and keeps the ones
with little or no industry money (Open Payments), with practice locations and possible trial sites.

skills eval runs each skill's eval suite against Claude with the openlabel tools and prints
its pass rate; it exits 1 if any case fails. --save writes a full run's results to
plugin/skills/results.json, which the site shows.

search prints the label sentences that best match a question, with their citations.

diff prints every sentence that changed between two versions of a label (default: the
current version and the one before it).

watch reads the reports that check --save left in a folder (default: the current one),
diffs each piece's label against the current version, and lists what the change touches.

Options:
  --rules <file>         a YAML rule pack (defaults to fda-core)
  --label-version <n>    check against a past label version instead of the current one
  --json                 print the report as JSON
  --plain                print text even at a terminal, instead of the interactive screen
  --save                 write the report next to the piece (<file>.check.json) for watch
  --provider <name>      anthropic, openai, openrouter, gemini, groq or ollama (default: the first
                         whose key is set: ANTHROPIC_API_KEY, OPENAI_API_KEY, OPENROUTER_API_KEY,
                         GEMINI_API_KEY, GROQ_API_KEY)
  --model <id>           model id; required for every provider but anthropic (default claude-opus-5-5)
  --state <code>         unseen: two-letter state
  --specialty <name>     unseen: Part D prescriber type, such as Dermatology
  --drug <generic>       unseen: generic drug name; repeat for several
  --max-payments <usd>   unseen: most industry payments allowed over three years
  --limit <n>            unseen: how many doctors to list (default 10)
  -h, --help             show this help

Exit codes: 0 all supported, 1 overstated or warning, 2 off-label, unsupported or violation,
64 usage error, 69 the check could not run (network or API).`;

export type Io = {
  stdout: (text: string) => void;
  stderr: (text: string) => void;
  // A status line that the next one replaces; null clears it. Absent when nobody is watching.
  status?: (text: string | null) => void;
  // True when a person is at a terminal and the OpenTUI screen can run (under Bun).
  interactive?: boolean;
  color: boolean;
};

export const SKILLS_DIR = fileURLToPath(new URL("../../../plugin/skills", import.meta.url));
const SMS_PACK = fileURLToPath(new URL("../../../examples/pulse-sms.yaml", import.meta.url));

export type Deps = {
  llm?: () => Llm;
  evaluate?: (skill: string, only: string | undefined) => Promise<SkillResult>;
  dailyMed?: DailyMed;
  model?: (id: string | undefined) => ClaimModel;
  parseQuery?: ParseQuery;
  unseen?: (search: Search) => Promise<UnseenResult>;
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

export function describeProgress(progress: Progress): string {
  if (progress.phase === "extracting") return "extracting claims";
  return progress.total === 0 ? "no claims found" : `judging claims ${progress.done}/${progress.total}`;
}

function parse(argv: string[]) {
  return parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      label: { type: "string" },
      "label-version": { type: "string" },
      rules: { type: "string" },
      json: { type: "boolean", default: false },
      plain: { type: "boolean", default: false },
      save: { type: "boolean", default: false },
      model: { type: "string" },
      provider: { type: "string" },
      help: { type: "boolean", short: "h", default: false },
      state: { type: "string" },
      specialty: { type: "string" },
      drug: { type: "string", multiple: true },
      "max-payments": { type: "string" },
      limit: { type: "string" },
      from: { type: "string" },
      to: { type: "string" },
      case: { type: "string" },
    },
  });
}

type Context = ReturnType<typeof parse> & { io: Io; deps: Deps };

type Command = (context: Context) => Promise<number>;

function usage(io: Io): number {
  io.stderr(USAGE);
  return 64;
}

// Returns null after reporting a setup problem (unknown provider, missing key or model).
function makeLlm({ values, io, deps }: Context): Llm | null {
  try {
    return deps.llm ? deps.llm() : llmFromEnv({ ...(values.provider && { provider: values.provider }), ...(values.model && { model: values.model }) });
  } catch (error) {
    io.stderr(`openlabel: ${(error as Error).message}`);
    return null;
  }
}

const COMMANDS: Record<string, Command> = {
  async check(context) {
    const { values, positionals, io, deps } = context;
    const file = positionals[1];
    if (!file || !values.label) return usage(io);

    const labelVersion = values["label-version"] === undefined ? undefined : Number(values["label-version"]);
    if (labelVersion !== undefined && !Number.isInteger(labelVersion)) {
      io.stderr(`openlabel: --label-version must be a whole number\n\n${USAGE}`);
      return 64;
    }

    const llm = deps.model ? null : makeLlm(context);
    if (!deps.model && !llm) return 64;

    let piece: string;
    let pack = FDA_CORE;
    try {
      piece = pieceText(file, await readFile(file, "utf8"));
      if (values.rules) pack = loadPack(await readFile(values.rules, "utf8"));
    } catch (error) {
      io.stderr(`openlabel: ${(error as Error).message}`);
      return 64;
    }

    const model = deps.model ? deps.model(values.model) : claimModel(llm!);
    const labelQuery = values.label;
    const runCheck = async (hooks: { label: (title: string) => void; progress: (p: Progress) => void }) => {
      const label = await (deps.dailyMed ?? dailyMed()).resolve(labelQuery, labelVersion);
      hooks.label(`${label.title} · label v${label.version}`);
      const report = await check({ piece, label, model, pack, onProgress: hooks.progress });
      if (values.save) {
        const saved: SavedCheck = { ...report, checkedAt: new Date().toISOString() };
        await writeFile(sidecarPath(file), `${JSON.stringify(saved, null, 2)}\n`);
      }
      return report;
    };

    // A person at a terminal under Bun gets the OpenTUI screen; scripts and --json get text.
    if (io.interactive && !values.json && !values.plain) {
      const { checkUi } = await import("./ui/check-ui.ts");
      const { report, error } = await checkUi(file, labelQuery, runCheck);
      if (report) {
        io.stdout(formatReport(report, { color: io.color }));
        return report.exitCode;
      }
      if (error) throw new Error(error);
      return 130;
    }

    io.status?.(`fetching the ${labelQuery} label`);
    let report;
    try {
      report = await runCheck({ label: () => {}, progress: (p) => io.status?.(describeProgress(p)) });
    } finally {
      io.status?.(null);
    }
    io.stdout(values.json ? JSON.stringify(report, null, 2) : formatReport(report, { color: io.color }));
    return report.exitCode;
  },

  async watch({ values, positionals, io, deps }) {
    const folder = resolve(positionals[1] ?? ".");
    const result = await watchLibrary(await loadLibrary(folder), deps.dailyMed ?? dailyMed());
    io.stdout(values.json ? JSON.stringify(result, null, 2) : formatWatch(result, { color: io.color, cwd: folder }));
    return result.pieces.some((p) => p.impacts.length) ? 1 : 0;
  },

  async skills({ values, positionals, io, deps }) {
    if (values.provider && values.provider !== "anthropic") {
      io.stderr("openlabel: skills eval runs Claude, because the skills run in Claude Code; drop --provider");
      return 64;
    }
    if (positionals[1] !== "eval" || (values.save && (positionals[2] || values.case))) {
      io.stderr(values.save ? `openlabel: --save needs a full run, without a skill or --case\n\n${USAGE}` : USAGE);
      return 64;
    }
    const names = positionals[2] ? [positionals[2]] : await listSkills(SKILLS_DIR);
    const model = values.model ?? DEFAULT_ANTHROPIC_MODEL;
    const evaluate =
      deps.evaluate ?? claudeEvaluator({ skillsDir: SKILLS_DIR, model, packs: { "pulse-sms": await readFile(SMS_PACK, "utf8") } });
    const results: SkillResult[] = [];
    for (const name of names) results.push(await evaluate(name, values.case));
    if (values.save) {
      const file = summarize(results, model, new Date());
      await writeFile(join(SKILLS_DIR, RESULTS_FILE), `${JSON.stringify(file, null, 2)}\n`);
    }
    io.stdout(values.json ? JSON.stringify(results, null, 2) : formatSkills(results, { color: io.color }));
    return results.every((r) => r.passed === r.total) ? 0 : 1;
  },

  async search({ values, positionals, io, deps }) {
    const drug = positionals[1];
    const question = positionals.slice(2).join(" ").trim();
    const limit = Number(values.limit ?? 8);
    if (!drug || !question || !Number.isInteger(limit) || limit < 1) return usage(io);
    const label = await (deps.dailyMed ?? dailyMed()).resolve(drug);
    const hits = retriever(label)(question, "other", limit);
    const lines = hits.map((s) => `${cite(s)}  ${s.context ? `(${s.context}) ` : ""}${s.text}`);
    io.stdout(
      values.json
        ? JSON.stringify({ label: { title: label.title, version: label.version }, sentences: hits }, null, 2)
        : [`${label.title} · label v${label.version}`, "", ...lines.map((l) => `  ${l}`)].join("\n"),
    );
    return 0;
  },

  async diff({ values, positionals, io, deps }) {
    const drug = positionals[1];
    const versionOf = (value: string | undefined) => (value === undefined ? undefined : Number(value));
    const [from, to] = [versionOf(values.from), versionOf(values.to)];
    if (!drug || [from, to].some((v) => v !== undefined && !Number.isInteger(v))) return usage(io);
    const diff = await diffDrugLabel(deps.dailyMed ?? dailyMed(), drug, { from, to });
    io.stdout(values.json ? JSON.stringify(diff, null, 2) : formatDiff(diff, { color: io.color }));
    return 0;
  },

  async unseen(context) {
    const { values, positionals, io, deps } = context;
    const limit = Number(values.limit ?? 10);
    const maxPayments = values["max-payments"] === undefined ? undefined : Number(values["max-payments"]);
    const question = positionals.slice(1).join(" ").trim();
    const byFlags = values.state && values.specialty && values.drug?.length;
    if (!Number.isInteger(limit) || limit < 1 || (maxPayments !== undefined && !(maxPayments >= 0)) || (!question && !byFlags)) {
      return usage(io);
    }
    let parse = deps.parseQuery ?? null;
    if (!byFlags && !parse) {
      const llm = makeLlm(context);
      if (!llm) return 64;
      parse = queryParser(llm);
    }
    const parsed = byFlags
      ? { state: values.state!.toUpperCase(), specialty: values.specialty!, drugs: values.drug!, maxPayments: maxPayments ?? null }
      : await parse!(question);
    const search: Search = { ...parsed, maxPayments: maxPayments ?? parsed.maxPayments, limit };
    const result = await (deps.unseen ?? ((s: Search) => unseen(s)))(search);
    io.stdout(values.json ? JSON.stringify(result, null, 2) : formatUnseen(result, { color: io.color }));
    return 0;
  },
};

export async function run(argv: string[], io: Io, deps: Deps = {}): Promise<number> {
  let parsed;
  try {
    parsed = parse(argv);
  } catch (error) {
    io.stderr(`${(error as Error).message}\n\n${USAGE}`);
    return 64;
  }
  if (parsed.values.help) {
    io.stdout(USAGE);
    return 0;
  }
  const name = parsed.positionals[0] ?? "";
  const command = Object.hasOwn(COMMANDS, name) ? COMMANDS[name] : undefined;
  if (!command) return usage(io);
  try {
    return await command({ ...parsed, io, deps });
  } catch (error) {
    io.stderr(`openlabel: ${(error as Error).message}`);
    return 69;
  }
}
