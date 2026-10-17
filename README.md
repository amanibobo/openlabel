<div align="center">

<h1><picture><source media="(prefers-color-scheme: dark)" srcset=".github/readme-assets/logo-dark.svg"><img src=".github/readme-assets/logo-light.svg" alt="" width="56" align="absmiddle" /></picture> Open Label</h1>

Open tools that keep every message to a doctor true to the FDA label.

<p>
<a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="MIT license" /></a>
<a href="https://au-2a4a5dc8.mintlify.app"><img src="https://img.shields.io/badge/docs-mintlify-18E299?style=flat-square" alt="Docs" /></a>
<img src="https://img.shields.io/badge/node-22%2B-5FA04E?style=flat-square" alt="Node 22+" />
</p>

<p><a href="https://openlabel-two.vercel.app"><img src="docs/media/demo.gif" alt="openlabel check reviewing a print ad in the terminal: claims fill in with verdicts and label citations while the ad is outlined" width="680" /></a></p>

<hr />

<p>Claim checks, label-change tracking, public-data HCP discovery and agent skills, for the teams that write to physicians and the reviewers who sign off. Every verdict is traced to a sentence in the drug's prescribing information, so a reviewer can check it in seconds.</p>

<p>
<a href="https://openlabel-two.vercel.app"><picture><source media="(prefers-color-scheme: dark)" srcset=".github/readme-assets/button-site-dark.svg"><img src=".github/readme-assets/button-site-light.svg" alt="Open the site" width="220" height="44" /></picture></a>
<a href="https://au-2a4a5dc8.mintlify.app"><picture><source media="(prefers-color-scheme: dark)" srcset=".github/readme-assets/button-docs-dark.svg"><img src=".github/readme-assets/button-docs-light.svg" alt="Read the docs" width="220" height="44" /></picture></a>
</p>

<p><sub>Node 22+ · <a href="https://bun.sh">Bun</a> for the interactive screen · Claude or any OpenAI-compatible model</sub></p>

</div>

## Get started

```sh
git clone https://github.com/amanibobo/openlabel
cd openlabel
npm install
echo "ANTHROPIC_API_KEY=sk-ant-..." > .env
npx openlabel check examples/dupixent-email.html --label dupixent
```

Run the same check with <img src=".github/readme-assets/bun.svg" alt="" width="16" height="16" align="texttop" /> Bun to get the full-screen view built with <img src=".github/readme-assets/opentui.svg" alt="" width="16" height="16" align="texttop" /> OpenTUI: claims on the left as they're judged, the label sentences behind each verdict on the right.

```sh
bun packages/cli/src/main.ts check examples/dupixent-email.html --label dupixent
```

<details>
<summary>Use another model provider</summary>

Claude is the default. Any provider with an OpenAI-style API works too, with a model id:

```sh
echo "OPENROUTER_API_KEY=sk-or-..." >> .env
npx openlabel check email.html --label dupixent --provider openrouter --model <model id>
```

| Provider | Key |
| --- | --- |
| <img src=".github/readme-assets/claude.svg" alt="" width="14" height="14" /> Anthropic (default) | `ANTHROPIC_API_KEY` |
| OpenAI | `OPENAI_API_KEY` |
| <img src=".github/readme-assets/openrouter.svg" alt="" width="14" height="14" /> OpenRouter | `OPENROUTER_API_KEY` |
| <img src=".github/readme-assets/googlegemini.svg" alt="" width="14" height="14" /> Gemini | `GEMINI_API_KEY` |
| Groq | `GROQ_API_KEY` |
| <img src=".github/readme-assets/ollama.svg" alt="" width="14" height="14" /> Ollama | none, runs locally |

See [Models and providers](https://au-2a4a5dc8.mintlify.app/cli/overview#models-and-providers).

</details>

<details>
<summary>Install the skills in Claude Code</summary>

```sh
npm link -w openlabel
claude plugin marketplace add amanibobo/openlabel
claude plugin install openlabel-skills@openlabel
```

Then ask Claude Code things like "is this email on-label?" or "draft a reply to this question about pregnancy".

</details>

## How it works

**Check every claim against the label.** `openlabel check` pulls each claim out of an email, text, slide or HTML piece and matches it to the sentence in the FDA prescribing information that supports it. Labels come straight from DailyMed and are cited by section and paragraph, such as §14.1 ¶12. Every verdict (supported, overstated, off-label, unsupported) must cite a sentence the model was shown, and team rule packs in YAML catch missing safety information, superlatives and length limits without a model.

**Know what a label change broke.** Save each approved piece's check with `--save`, and `openlabel watch` diffs the label each one was approved against with today's. It lists every claim that rested on a sentence that changed, with what it said then and says now, and exits 1 so a nightly CI job can open an issue.

**Find the doctors nobody calls on.** `openlabel unseen` ranks a specialty's Medicare Part D prescribers of a drug in one state, keeps those with little or no industry money in Open Payments, and adds practice locations from NPPES and possible trial sites from ClinicalTrials.gov. Ask in plain language or use flags.

```sh
npx openlabel unseen "Georgia dermatologists prescribing dupilumab with under \$100 in industry payments"
```

**Give agents the procedures.** Five <img src=".github/readme-assets/claude.svg" alt="" width="16" height="16" align="texttop" /> Claude Code skills for medical affairs and HCP engagement, packaged as one plugin: `claim-check`, `label-diff`, `fair-balance`, `hcp-sms` and `med-info-response`. Each ships with the eval suite that grades it, and `openlabel skills eval` runs them against real labels.

**Read any label.** `openlabel search dupixent "pregnancy"` finds the sentences that answer a question, and `openlabel diff dupixent --from 53` prints everything FDA changed between two versions.

## Data and privacy

Open Label reads public data only: DailyMed labels, CMS Part D (2024, the newest year published), Open Payments (2023 to 2025), NPPES and ClinicalTrials.gov. None of it contains patient data. Check sends your piece and the label sentences it chose to the model provider you configure; nothing else leaves your machine, and Open Label collects no analytics.

Unseen's results are leads to verify, not facts: Part D covers Medicare patients and pharmacy-dispensed drugs only, and trial matches are by name because ClinicalTrials.gov has no NPIs. See [Data sources](https://au-2a4a5dc8.mintlify.app/concepts/data-sources).

## Development

<details>
<summary>Repository layout</summary>

| Path | What it is |
| --- | --- |
| `packages/label` | Fetches labels from DailyMed and parses them into numbered sections and citable sentences |
| `packages/check` | Extracts and judges claims, runs rule packs |
| `packages/watch` | Diffs label versions and finds the saved claims a change touches |
| `packages/unseen` | Joins CMS Part D, Open Payments, NPPES and ClinicalTrials.gov on NPI |
| `packages/llm` | One JSON-with-a-schema interface over Claude and OpenAI-compatible providers |
| `packages/skills` | Runs the skills' eval suites |
| `packages/cli` | The `openlabel` command, plain and OpenTUI |
| `plugin` | The Claude Code plugin; `.claude-plugin/marketplace.json` lists it |
| `apps/web` | The site, built with Next.js |
| `apps/docs` | The docs, built with <img src=".github/readme-assets/mintlify.svg" alt="" width="14" height="14" /> Mintlify |
| `tui` | The OpenTUI app that records the demo above |

</details>

```sh
npm test            # every package
npm run typecheck
npm run dev         # the site
npm run docs        # the docs
```

<details>
<summary>Re-record the terminal demo</summary>

```sh
cd tui
bun install
bun run demo     # play it in your terminal
bun run record   # regenerate apps/web/public/demo/check.{mp4,webm} and the poster
bun run gif      # regenerate docs/media/demo.gif from the mp4
```

</details>

Lorvexa, the drug in the demo and on the site, is fictional. The ad photo is by [Erik Allen on Pexels](https://www.pexels.com/photo/2589840/).

## License

[MIT](LICENSE)
