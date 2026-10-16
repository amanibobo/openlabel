# Open Label

A concept site for open tools that keep every message to a doctor true to the FDA label.

- **Check** matches each claim in a piece, including what its imagery implies, to the label sentence that supports it.
- **Watch** turns a label revision into the list of approved claims it broke.
- **Unseen** finds no-see and low-see doctors from public data (NPPES, CMS Part D, Open Payments, ClinicalTrials.gov).
- **Skills** packages medical affairs agent skills, each with its eval suite.

Check and Watch work today. Unseen and Skills are next; see `docs/plan.md`. Lorvexa, the drug on the site, is fictional, and the site's figures are illustrative.

## Check a piece

Check needs an Anthropic API key in `ANTHROPIC_API_KEY` (a `.env` file in the working directory is read automatically).

```sh
npm install
npx openlabel check examples/dupixent-email.html --label dupixent
npx openlabel check examples/dupixent-sms.txt --label dupixent --rules examples/pulse-sms.yaml
npx openlabel check examples/dupixent-email.html --label dupixent --json
```

It fetches the current label from DailyMed, pulls every claim out of the piece, finds the label sentences each one could rest on, and asks Claude for a verdict that must cite one of them. Rule packs are YAML and run without a model.

Exit codes: 0 when every claim is supported, 1 for overstated claims or warnings, 2 for off-label or unsupported claims or rule violations, 64 for usage errors, 69 when the check could not run.

## Watch a library

Save each approved piece's check next to it, then run `watch` on the folder whenever you like. It diffs the label each piece was checked against with today's label and lists every claim that rested on a sentence that changed.

```sh
npx openlabel check approved/email.html --label dupixent --save
npx openlabel watch approved
```

`watch` exits 0 when nothing in the folder is affected and 1 when something is, so it can run on a schedule in CI. Inserting a table renumbers every later table; the diff ignores that.

## Run the site

```sh
npm run dev
```

## The terminal demo

The hero video is a real [OpenTUI](https://opentui.com) app in `tui/`, recorded through xterm.js.

```sh
cd tui
bun install
bun run demo     # play it in your terminal
bun run record   # regenerate apps/web/public/demo/check.{mp4,webm} and the poster
```

## Layout

- `packages/label` fetches labels from DailyMed and parses them into numbered sections and citable sentences.
- `packages/check` extracts and judges claims and runs rule packs.
- `packages/watch` diffs label versions and finds the saved claims a change touches.
- `packages/cli` is the `openlabel` command.
- `apps/web` is the site. `app/content.ts` holds its copy and example data, and `app/geo.ts` projects county maps from `us-atlas` at build time.
- `apps/web/assets-src/lorvexa-ad.html` is the source of `apps/web/public/images/lorvexa-ad.png`. The photo is by [Erik Allen on Pexels](https://www.pexels.com/photo/2589840/).
