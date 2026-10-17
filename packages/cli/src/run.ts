import { readFile, writeFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { check, claimModel, FDA_CORE, loadPack, retriever, sidecarPath, type ClaimModel, type Progress, type SavedCheck } from "@openlabel/check";
import { cite, dailyMed, type DailyMed } from "@openlabel/label";
import { anthropicLlm, llmFromEnv, type Llm } from "@openlabel/llm";
import { queryParser, unseen, type ParseQuery, type Search, type UnseenResult } from "@openlabel/unseen";
import { diffLabels, loadLibrary, watchLibrary } from "@openlabel/watch";
import { claudeJudge, evaluateSkill, listSkills, openLabelTools, RESULTS_FILE, runSkill, summarize, type SkillResult } from "@openlabel/skills";
import Anthropic from "@anthropic-ai/sdk";
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

export async function run(argv: string[], io: Io, deps: Deps = {}): Promise<number> {
  // Returns null after reporting a setup problem (unknown provider, missing key or model).
  const makeLlm = (values: { provider?: string | undefined; model?: string | undefined }): Llm | null => {
    try {
      return deps.llm ? deps.llm() : llmFromEnv({ ...(values.provider && { provider: values.provider }), ...(values.model && { model: values.model }) });
    } catch (error) {
      io.stderr(`openlabel: ${(error as Error).message}`);
      return null;
    }
  };

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
  if (command === "watch") {
    try {
      const folder = resolve(file ?? ".");
      const result = await watchLibrary(await loadLibrary(folder), deps.dailyMed ?? dailyMed());
      io.stdout(values.json ? JSON.stringify(result, null, 2) : formatWatch(result, { color: io.color, cwd: folder }));
      return result.pieces.some((p) => p.impacts.length) ? 1 : 0;
    } catch (error) {
      io.stderr(`openlabel: ${(error as Error).message}`);
      return 69;
    }
  }
  if (command === "skills") {
    if (values.provider && values.provider !== "anthropic") {
      io.stderr("openlabel: skills eval runs Claude, because the skills run in Claude Code; drop --provider");
      return 64;
    }
    if (file !== "eval" || (values.save && (positionals[2] || values.case))) {
      io.stderr(values.save ? `openlabel: --save needs a full run, without a skill or --case\n\n${USAGE}` : USAGE);
      return 64;
    }
    try {
      const names = positionals[2] ? [positionals[2]] : await listSkills(SKILLS_DIR);
      const evaluate =
        deps.evaluate ??
        (await (async () => {
          const client = new Anthropic();
          const id = values.model ?? "claude-opus-5-5";
          const tools = openLabelTools({
            dailyMed: dailyMed(),
            model: claimModel(anthropicLlm({ client, model: id })),
            packs: { "pulse-sms": await readFile(SMS_PACK, "utf8") },
          });
          const judge = claudeJudge(client, id);
          return (skill: string, only: string | undefined) =>
            evaluateSkill(SKILLS_DIR, skill, {
              judge,
              ...(only && { only }),
              run: (skillText, prompt) => runSkill({ client, model: id, skill: skillText, prompt, tools }),
            });
        })());
      const results: SkillResult[] = [];
      for (const name of names) results.push(await evaluate(name, values.case));
      if (values.save) {
        const file = summarize(results, values.model ?? "claude-opus-5-5", new Date());
        await writeFile(join(SKILLS_DIR, RESULTS_FILE), `${JSON.stringify(file, null, 2)}\n`);
      }
      io.stdout(values.json ? JSON.stringify(results, null, 2) : formatSkills(results, { color: io.color }));
      return results.every((r) => r.passed === r.total) ? 0 : 1;
    } catch (error) {
      io.stderr(`openlabel: ${(error as Error).message}`);
      return 69;
    }
  }
  if (command === "search") {
    const question = positionals.slice(2).join(" ").trim();
    const limit = Number(values.limit ?? 8);
    if (!file || !question || !Number.isInteger(limit) || limit < 1) {
      io.stderr(USAGE);
      return 64;
    }
    try {
      const label = await (deps.dailyMed ?? dailyMed()).resolve(file);
      const hits = retriever(label)(question, "other", limit);
      const lines = hits.map((s) => `${cite(s)}  ${s.context ? `(${s.context}) ` : ""}${s.text}`);
      io.stdout(
        values.json
          ? JSON.stringify({ label: { title: label.title, version: label.version }, sentences: hits }, null, 2)
          : [`${label.title} · label v${label.version}`, "", ...lines.map((l) => `  ${l}`)].join("\n"),
      );
      return 0;
    } catch (error) {
      io.stderr(`openlabel: ${(error as Error).message}`);
      return 69;
    }
  }
  if (command === "diff") {
    const versionOf = (value: string | undefined) => (value === undefined ? undefined : Number(value));
    const [fromVersion, toVersion] = [versionOf(values.from), versionOf(values.to)];
    if (!file || [fromVersion, toVersion].some((v) => v !== undefined && !Number.isInteger(v))) {
      io.stderr(USAGE);
      return 64;
    }
    try {
      const client = deps.dailyMed ?? dailyMed();
      const after = await client.resolve(file, toVersion);
      const previous = fromVersion ?? (await client.versions(after.setId)).find((v) => v.version < after.version)?.version;
      if (previous === undefined) throw new Error(`${after.title} has no earlier version on DailyMed`);
      const diff = diffLabels(await client.label(after.setId, previous), after);
      io.stdout(values.json ? JSON.stringify(diff, null, 2) : formatDiff(diff, { color: io.color }));
      return 0;
    } catch (error) {
      io.stderr(`openlabel: ${(error as Error).message}`);
      return 69;
    }
  }
  if (command === "unseen") {
    const limit = Number(values.limit ?? 10);
    const maxPayments = values["max-payments"] === undefined ? undefined : Number(values["max-payments"]);
    const question = positionals.slice(1).join(" ").trim();
    const byFlags = values.state && values.specialty && values.drug?.length;
    if (!Number.isInteger(limit) || limit < 1 || (maxPayments !== undefined && !(maxPayments >= 0)) || (!question && !byFlags)) {
      io.stderr(USAGE);
      return 64;
    }
    let parse = deps.parseQuery ?? null;
    if (!byFlags && !parse) {
      const llm = makeLlm(values);
      if (!llm) return 64;
      parse = queryParser(llm);
    }
    try {
      const parsed = byFlags
        ? { state: values.state!.toUpperCase(), specialty: values.specialty!, drugs: values.drug!, maxPayments: maxPayments ?? null }
        : await parse!(question);
      const search: Search = { ...parsed, maxPayments: maxPayments ?? parsed.maxPayments, limit };
      const result = await (deps.unseen ?? ((s: Search) => unseen(s)))(search);
      io.stdout(values.json ? JSON.stringify(result, null, 2) : formatUnseen(result, { color: io.color }));
      return 0;
    } catch (error) {
      io.stderr(`openlabel: ${(error as Error).message}`);
      return 69;
    }
  }
  if (command !== "check" || !file || !values.label) {
    io.stderr(USAGE);
    return 64;
  }

  const labelVersion = values["label-version"] === undefined ? undefined : Number(values["label-version"]);
  if (labelVersion !== undefined && !Number.isInteger(labelVersion)) {
    io.stderr(`openlabel: --label-version must be a whole number\n\n${USAGE}`);
    return 64;
  }

  const llm = deps.model ? null : makeLlm(values);
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

  try {
    io.status?.(`fetching the ${values.label} label`);
    const label = await (deps.dailyMed ?? dailyMed()).resolve(values.label, labelVersion);
    const model = deps.model ? deps.model(values.model) : claimModel(llm!);
    const report = await check({ piece, label, model, pack, onProgress: (p) => io.status?.(describeProgress(p)) });
    io.status?.(null);
    if (values.save) {
      const saved: SavedCheck = { ...report, checkedAt: new Date().toISOString() };
      await writeFile(sidecarPath(file), `${JSON.stringify(saved, null, 2)}\n`);
    }
    io.stdout(values.json ? JSON.stringify(report, null, 2) : formatReport(report, { color: io.color }));
    return report.exitCode;
  } catch (error) {
    io.status?.(null);
    io.stderr(`openlabel: ${(error as Error).message}`);
    return 69;
  }
}
