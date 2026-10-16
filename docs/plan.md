# Build plan

Open Label ships as an `openlabel` CLI backed by small TypeScript packages. The site in `apps/web` stays a marketing page.

## Layout

- `apps/web` is the Next.js site.
- `packages/label` fetches FDA labels from DailyMed and turns them into numbered sections and citable sentences.
- `packages/check` extracts claims from a piece, finds candidate label sentences, judges each claim, and runs rule packs.
- `packages/cli` is the `openlabel` command.
- `tui` is the OpenTUI demo that produces the site's hero video.

## Order

1. Monorepo and the label engine. Labels come from DailyMed SPL XML, which keeps section numbers ("14.1") and paragraphs, so every sentence can be cited as `§14.1 ¶3`.
2. Check. Claims are extracted and judged with Claude. Retrieval is local BM25 over label sentences, so the model only sees a short list of candidates and must cite one of them. Rule packs are YAML and run without a model.
3. Watch. Diff two label versions sentence by sentence, classify the change, then look up which stored claims cited the changed sentences.
4. Unseen. Join NPPES, CMS Part D, Open Payments and ClinicalTrials.gov through their public APIs, keyed on NPI.
5. Skills. A Claude Code plugin whose skills call the CLI, each with an eval suite.

## Core shapes

- A `Label` has a set id, a version, and a tree of `Section`s. Each section holds `Sentence`s with ids like `14.1:3.2` (section, paragraph, sentence).
- A `Claim` is a verbatim span of the piece. Extraction output that does not appear in the piece is rejected.
- A `Judgment` is a verdict (`supported`, `overstated`, `off-label`, `unsupported`), the sentence ids it rests on, and a one-line reason. Cited ids must come from the candidates the model was shown.
- Exit codes: 0 when every claim is supported and no rule fires, 1 for overstated claims or warnings, 2 for off-label or unsupported claims or rule violations, 64 for usage errors.

## Model use

Claude Opus 5.5 through `@anthropic-ai/sdk` with structured outputs. The key is read from `ANTHROPIC_API_KEY` (a local `.env`, never committed). Tests use a fake model so they run offline.
