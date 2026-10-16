# Open Label

A concept site for open tools that keep every message to a doctor true to the FDA label.

- **Check** matches each claim in a piece, including what its imagery implies, to the label sentence that supports it.
- **Watch** turns a label revision into the list of approved claims it broke.
- **Unseen** finds no-see and low-see doctors from public data (NPPES, CMS Part D, Open Payments, ClinicalTrials.gov).
- **Skills** packages medical affairs agent skills, each with its eval suite.

The tools themselves are not built yet. Lorvexa is a fictional drug, and every record and figure on the site is illustrative.

## Run the site

```sh
npm install
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

- `apps/web` is the site. `app/content.ts` holds its copy and example data, and `app/geo.ts` projects county maps from `us-atlas` at build time.
- `apps/web/assets-src/lorvexa-ad.html` is the source of `apps/web/public/images/lorvexa-ad.png`. The photo is by [Erik Allen on Pexels](https://www.pexels.com/photo/2589840/).
