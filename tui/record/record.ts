// Records the demo into apps/web/public/demo/: sizes an xterm.js terminal (WebGL renderer,
// image addon for sixel) in headless Chromium, runs the app in a PTY of that size,
// captures its byte stream with timestamps, replays it frame by frame into the
// terminal, and encodes the screenshots with ffmpeg.
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { chromium } from "playwright-core";

const TUI = resolve(import.meta.dir, "..");
const OUT = process.env.OUT_DIR ?? resolve(TUI, "../apps/web/public/demo");
const WORK = join(tmpdir(), "openlabel-record");
const CHROME =
  process.env.CHROME_PATH ??
  `${process.env.HOME}/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell`;
const FFMPEG = process.env.FFMPEG_PATH ?? "/opt/homebrew/bin/ffmpeg";

const WIDTH = 1600;
const HEIGHT = 900;
const FPS = 30;
const COLS = Number(process.env.COLS ?? 136);
const ROWS = Number(process.env.ROWS ?? 35);
const FONT_SIZE = Number(process.env.FONT_SIZE ?? 17);
const LINE_HEIGHT = Number(process.env.LINE_HEIGHT ?? 1);
const LETTER_SPACING = Number(process.env.LETTER_SPACING ?? 1);
const HOLD_MS = 2000;
// The app leaves a blank top row and ends its detail pane two rows short of the
// bottom, so the grid is nudged down one cell to center the visible content.
const OFFSET_Y = Number(process.env.OFFSET_Y ?? 22);

const entry = process.argv[2] ?? join(TUI, "src/main.ts");
const durationMs =
  Number(process.env.DURATION_MS) ||
  (await import(join(TUI, "src/timeline.ts"))).DEMO_DURATION_MS + HOLD_MS;

type Chunk = { ms: number; data: string };

type Px = { width: number; height: number };

// The PTY has no emulator behind it, so the capture answers OpenTUI's pixel-size
// query (CSI 14 t) with the replay terminal's own size. With a pixel size known,
// OpenTUI draws the image as sixel instead of half-block cells.
async function capture(px: Px): Promise<Chunk[]> {
  const chunks: Chunk[] = [];
  const decoder = new TextDecoder();
  let start = 0;
  const proc = Bun.spawn([process.execPath, entry], {
    cwd: TUI,
    env: { ...process.env, TERM: "xterm-256color", COLORTERM: "truecolor", OPENLABEL_IMAGE_PROTOCOL: process.env.OPENLABEL_IMAGE_PROTOCOL ?? "sixel" },
    terminal: {
      cols: COLS,
      rows: ROWS,
      data(terminal, bytes) {
        const now = performance.now();
        const data = decoder.decode(bytes, { stream: true });
        if (data.includes("\x1b[14t")) terminal.write(`\x1b[4;${px.height};${px.width}t`);
        // The clock starts when the app enters the alternate screen, so startup
        // and capability probing don't become dead air at the head of the video.
        if (!start && data.includes("\x1b[?1049h")) start = now;
        chunks.push({ ms: start ? now - start : 0, data });
      },
    },
  });
  const deadline = performance.now() + durationMs + 4000;
  while (performance.now() < deadline && (!start || performance.now() - start < durationMs + 300)) {
    await Bun.sleep(50);
  }
  proc.kill();
  await proc.exited;
  if (!start) throw new Error("app never entered the alternate screen");
  return chunks;
}

const page = (fontUrl: string) => `<!doctype html>
<html><head><meta charset="utf-8">
<link rel="stylesheet" href="file://${TUI}/node_modules/@xterm/xterm/css/xterm.css">
<style>
@font-face { font-family: "Geist Mono"; src: url("${fontUrl}") format("woff2"); font-weight: 400; }
@font-face { font-family: "Geist Mono"; src: url("${fontUrl.replace("-400-", "-600-")}") format("woff2"); font-weight: 600 700; }
html, body { margin: 0; width: ${WIDTH}px; height: ${HEIGHT}px; background: #151516; overflow: hidden; }
#t { position: absolute; }
.xterm-viewport { overflow: hidden !important; background: #151516 !important; }
</style>
<script src="file://${TUI}/node_modules/@xterm/xterm/lib/xterm.js"></script>
<script src="file://${TUI}/node_modules/@xterm/addon-webgl/lib/addon-webgl.js"></script>
<script src="file://${TUI}/node_modules/@xterm/addon-image/lib/addon-image.js"></script>
</head><body><div id="t"></div></body></html>`;

async function record(framesDir: string): Promise<number> {
  const html = join(WORK, "term.html");
  await writeFile(html, page(`file://${TUI}/node_modules/@fontsource/geist-mono/files/geist-mono-latin-400-normal.woff2`));
  const browser = await chromium.launch({
    executablePath: CHROME,
    args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--allow-file-access-from-files"],
  });
  try {
    const tab = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 1 });
    await tab.goto(`file://${html}`);
    const renderer = await tab.evaluate(
      async ({ cols, rows, fontSize, lineHeight, letterSpacing, width, height, offsetY }) => {
        await document.fonts.load(`${fontSize}px "Geist Mono"`);
        const el = document.getElementById("t")!;
        const term = new (window as any).Terminal({
          cols,
          rows,
          fontSize,
          lineHeight,
          fontFamily: '"Geist Mono", Menlo, monospace',
          fontWeightBold: 600,
          letterSpacing,
          customGlyphs: true,
          allowProposedApi: true,
          scrollback: 0,
          theme: { background: "#151516", foreground: "#f5f5f7", cursor: "#151516", cursorAccent: "#151516" },
        });
        term.open(el);
        term.loadAddon(new (window as any).ImageAddon.ImageAddon({ pixelLimit: 16777216, sixelSizeLimit: 50000000, storageLimit: 256 }));
        let kind = "webgl";
        try {
          term.loadAddon(new (window as any).WebglAddon.WebglAddon());
        } catch {
          kind = "dom";
        }
        const box = el.querySelector(".xterm-screen")!.getBoundingClientRect();
        el.style.left = `${Math.round((width - box.width) / 2)}px`;
        el.style.top = `${Math.round((height - box.height) / 2) + offsetY}px`;
        (window as any).term = term;
        (window as any).feed = (data: string) =>
          new Promise<void>((done) =>
            term.write(data, () => requestAnimationFrame(() => requestAnimationFrame(() => done()))),
          );
        return { kind, w: box.width, h: box.height };
      },
      { cols: COLS, rows: ROWS, fontSize: FONT_SIZE, lineHeight: LINE_HEIGHT, letterSpacing: LETTER_SPACING, width: WIDTH, height: HEIGHT, offsetY: OFFSET_Y },
    );
    console.log(`xterm ${renderer.kind} renderer, terminal ${COLS}x${ROWS} = ${renderer.w}x${renderer.h}px`);
    const chunks = await capture({ width: Math.round(renderer.w), height: Math.round(renderer.h) });
    console.log(`captured ${chunks.length} chunks over ${Math.round(chunks.at(-1)!.ms)} ms`);

    const total = Math.ceil((durationMs / 1000) * FPS);
    let next = 0;
    let last: Buffer | null = null;
    for (let i = 0; i < total; i++) {
      const t = (i * 1000) / FPS;
      let data = "";
      while (next < chunks.length && chunks[next]!.ms <= t) data += chunks[next++]!.data;
      if (data || !last) {
        await tab.evaluate((d) => (window as any).feed(d), data);
        last = await tab.screenshot({ type: "png" });
      }
      await Bun.write(join(framesDir, `${String(i).padStart(5, "0")}.png`), last);
    }
    return total;
  } finally {
    await browser.close();
  }
}

async function ffmpeg(args: string[]) {
  const proc = Bun.spawn([FFMPEG, "-hide_banner", "-loglevel", "error", "-y", ...args], { stderr: "inherit" });
  if ((await proc.exited) !== 0) throw new Error(`ffmpeg failed: ${args.join(" ")}`);
}

await rm(WORK, { recursive: true, force: true });
const framesDir = join(WORK, "frames");
await mkdir(framesDir, { recursive: true });
await mkdir(OUT, { recursive: true });
try {
  const total = await record(framesDir);
  const input = ["-framerate", String(FPS), "-i", join(framesDir, "%05d.png")];
  await ffmpeg([...input, "-c:v", "libx264", "-preset", "slow", "-crf", "16", "-tune", "animation", "-pix_fmt", "yuv420p", "-movflags", "+faststart", join(OUT, "check.mp4")]);
  await ffmpeg([...input, "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "28", "-row-mt", "1", "-pix_fmt", "yuv420p", join(OUT, "check.webm")]);
  await Bun.write(join(OUT, "check-poster.png"), Bun.file(join(framesDir, `${String(total - 1).padStart(5, "0")}.png`)));
  console.log(`wrote ${total} frames to ${OUT}/check.{mp4,webm} and check-poster.png`);
} finally {
  if (!process.env.KEEP_FRAMES) await rm(WORK, { recursive: true, force: true });
}
