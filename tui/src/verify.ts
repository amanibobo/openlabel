import { NativeImage } from "@opentui/core";
import { createTestRenderer } from "@opentui/core/testing";
import { IMAGE_PATH, claims, verdicts, type Claim } from "./claims";
import { createScene, outlineFor, outlinedImage, strokeFor, type Size } from "./scene";
import { DEMO_DURATION_MS, viewAt } from "./timeline";

const sizes = (Bun.argv[2] ?? "136x38,120x34,110x32").split(",").map((s) => s.split("x").map(Number) as [number, number]);
const times = [300, 1200, 2500, 4200, 9000, DEMO_DURATION_MS - 500, DEMO_DURATION_MS];
const show = new Set((Bun.argv[3] ?? "").split(",").filter(Boolean).map(Number));
const source = await NativeImage.load(IMAGE_PATH);
let failures = 0;
const check = (ok: boolean, what: string) => {
  if (!ok) {
    failures++;
    console.log(`FAIL ${what}`);
  }
};

const BLOCKS = /[▀▄▌▐█▖▗▘▙▚▛▜▝▞▟ ]/;

const hex = (img: NativeImage, x: number, y: number) => {
  const raw = img.raw("rgba8");
  const at = y * raw.stride + x * 4;
  return "#" + [0, 1, 2].map((c) => raw.data[at + c]!.toString(16).padStart(2, "0")).join("");
};

// The outline is in the image pixels: its stroke has the verdict color, the pixels just inside
// it and at its center are the untouched picture, and everything outside the box is untouched.
function checkOutline(shown: NativeImage, size: Size, claim: Claim | null, tag: string) {
  check(shown.width === size.width && shown.height === size.height, `${tag} image is ${size.width}x${size.height} (${shown.width}x${shown.height})`);
  const plain = outlinedImage(source, size, null);
  if (!claim?.region) {
    check(Buffer.compare(shown.raw("rgba8").data, plain.raw("rgba8").data) === 0, `${tag} no outline without a region`);
  } else {
    const box = outlineFor(size, claim.region);
    const stroke = strokeFor(size);
    const midY = Math.round((box.y0 + box.y1) / 2);
    const midX = Math.round((box.x0 + box.x1) / 2);
    const color = verdicts[claim.verdict].color;
    for (const [x, y, where] of [[box.x0, midY, "left"], [box.x1, midY, "right"], [midX, box.y0, "top"], [midX, box.y1, "bottom"]] as const) {
      check(hex(shown, x, y) === color, `${tag} ${where} stroke is ${color} (${hex(shown, x, y)})`);
    }
    for (const [x, y, where] of [[box.x0 + stroke, midY, "inside"], [midX, midY, "center"], [Math.max(0, box.x0 - 1), midY, "outside"]] as const) {
      check(hex(shown, x, y) === hex(plain, x, y), `${tag} ${where} pixel untouched`);
    }
  }
  plain.dispose();
}

for (const [cols, rows] of sizes) {
  const t = await createTestRenderer({ width: cols, height: rows });
  const scene = await createScene(t.renderer, IMAGE_PATH);
  check(scene.image.image !== null, `${cols}x${rows} image loaded`);

  for (const ms of times) {
    const view = viewAt(ms);
    scene.apply(view);
    await t.renderOnce();
    const frame = t.captureCharFrame();
    const lines = frame.split("\n");
    const g = scene.geometry();
    const tag = `${cols}x${rows} @${ms}ms`;
    if (show.has(ms)) console.log(`--- ${tag}\n${frame}`);

    check(lines[1]!.includes("❯ openlabel check pulse/lorvexa-print-0412 --label lorvexa"), `${tag} header command`);
    check(lines[1]!.trimEnd().endsWith("Lorvexa label rev 06/2026 · 214 sentences"), `${tag} header right-aligned`);

    const imageCells = lines
      .slice(g.image.top, g.image.top + g.image.height)
      .flatMap((l) => [...l].slice(g.image.left, g.image.left + g.image.width));
    const glyphs = imageCells.filter((ch) => ch !== " " && BLOCKS.test(ch)).length;
    check(glyphs > imageCells.length * 0.9, `${tag} image drawn as block glyphs (${glyphs}/${imageCells.length})`);

    for (let i = 0; i < claims.length; i++) {
      const c = claims[i]!;
      const v = verdicts[c.verdict];
      const shown = frame.includes(`${v.glyph} ${v.label}`) && i < view.resolved;
      if (i < view.resolved) check(shown || c.verdict === "missing", `${tag} claim ${i + 1} resolved row`);
    }
    if (view.scanning !== null) check(frame.includes("matching against 214 label sentences"), `${tag} scanning text`);
    if (view.phase === "reading") check(frame.includes("reading piece"), `${tag} reading`);
    if (view.phase === "extracting") check(frame.includes("extracting claims · 5 found"), `${tag} extracting`);
    if (view.phase === "done") check(frame.includes("1 supported · 2 overstated · 2 violations · exit 2"), `${tag} summary`);

    const focused = view.focus === null ? null : claims[view.focus]!;
    await scene.image.loadPromise;
    checkOutline(scene.image.image!, { width: g.image.width * 2, height: g.image.height * 2 }, focused, tag);
    if (focused) {
      const evidence = focused.evidence;
      check(frame.includes(evidence.kind === "sentence" ? evidence.ref : evidence.rule), `${tag} detail ref`);
    }
    for (const [n, line] of lines.entries()) {
      check([...line].length <= cols, `${tag} row ${n} within width`);
    }
    const lastUsed = lines.findLastIndex((l) => l.trim() !== "");
    check(lastUsed < rows - 1, `${tag} bottom row free (last used ${lastUsed})`);
  }
  await t.dispose();
}

{
  const t = await createTestRenderer({ width: 136, height: 38 });
  const scene = await createScene(t.renderer, IMAGE_PATH);
  t.renderer.on("resize", (cols: number, rows: number) => scene.layout(cols, rows));
  scene.apply(viewAt(DEMO_DURATION_MS));
  t.resize(120, 34);
  await t.renderOnce();
  const g = scene.geometry();
  const lines = t.captureCharFrame().split("\n");
  check(g.image.width === 58 && [...lines[0]!].length === 120, `resize relayout (image ${g.image.width} wide, ${[...lines[0]!].length} cols)`);
  await scene.image.loadPromise;
  checkOutline(scene.image.image!, { width: g.image.width * 2, height: g.image.height * 2 }, claims[3]!, "outline follows resize");
  check(lines.some((l) => l.includes("1 supported · 2 overstated · 2 violations · exit 2")), "summary after resize");
  await t.dispose();
}

// The recording's sixel size: a 72x24-cell pane at 11x22 px per cell.
for (const claim of claims) {
  const shown = outlinedImage(source, { width: 792, height: 528 }, claim);
  checkOutline(shown, { width: 792, height: 528 }, claim, `sixel ${claim.text}`);
  shown.dispose();
}

check(JSON.stringify(viewAt(DEMO_DURATION_MS)) === JSON.stringify(viewAt(DEMO_DURATION_MS + 60_000)), "final frame holds");
check(viewAt(DEMO_DURATION_MS).focus === claims.findIndex((c) => c.verdict === "imagery"), "final focus on imagery");
console.log(failures === 0 ? `ok · DEMO_DURATION_MS=${DEMO_DURATION_MS}` : `${failures} failures`);
process.exit(failures === 0 ? 0 : 1);
