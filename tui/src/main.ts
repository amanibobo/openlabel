import { createCliRenderer, type KeyEvent } from "@opentui/core";
import { IMAGE_PATH, palette } from "./claims";
import { createScene } from "./scene";
import { DEMO_DURATION_MS, viewAt } from "./timeline";

const renderer = await createCliRenderer({ targetFps: 30, backgroundColor: palette.bg, exitOnCtrlC: false });
renderer.setBackgroundColor(palette.bg);

const scene = await createScene(renderer, IMAGE_PATH);
renderer.on("resize", (cols: number, rows: number) => scene.layout(cols, rows));

let quitting = false;
renderer.keyInput.on("keypress", async (key: KeyEvent) => {
  if (quitting || !(key.name === "q" || key.name === "escape" || (key.ctrl && key.name === "c"))) return;
  quitting = true;
  renderer.destroy();
  await renderer.closed;
  process.exit(0);
});

const start = performance.now();
let lastKey = "";
renderer.setFrameCallback(async () => {
  const elapsed = Math.min(performance.now() - start, DEMO_DURATION_MS);
  const view = viewAt(elapsed);
  const key = JSON.stringify(view);
  if (key !== lastKey) {
    lastKey = key;
    scene.apply(view);
  }
  scene.paint();
  if (elapsed >= DEMO_DURATION_MS) renderer.auto();
});
renderer.start();
