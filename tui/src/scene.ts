import {
  ImageRenderable,
  NativeImage,
  StyledText,
  TextRenderable,
  bold,
  fg,
  type CliRenderer,
  type ImageRenderProtocol,
  type Renderable,
  type TextChunk,
} from "@opentui/core";
import { IMAGE_SIZE, claims, cite, exitCode, label, palette, piece, summary, tones, verdicts, type Claim, type Region } from "./claims";
import type { View } from "./timeline";

type Segment = { text: string; color: string; strong?: boolean; keep?: boolean };
type Line = Segment[];

const MARGIN_X = 2;
const HEADER_Y = 1;
const CONTENT_Y = 3;
const PANE_GAP = 3;
// At 136 cols this gives 72x24 cells: 33.3 source px per row, so row edges fall at y=200 and
// y=233, between the subhead and the body line, and each text claim gets its own image row.
const IMAGE_SHARE = 0.53;
// Fits the longest claim on one line and the summary without truncation.
const MIN_PANE = 55;
const DETAIL_ROWS = 6;
const MARKER = "▍ ";
const LABEL_COL = 14;
const TEXT_COL = MARKER.length + LABEL_COL;

const seg = (text: string, color: string, strong = false): Segment => ({ text, color, strong });

function wrap(segments: Segment[], width: number): Line[] {
  const words = segments.flatMap((s) =>
    s.keep ? [s] : s.text.split(/(?<= )/).map((text) => ({ ...s, text })),
  );
  const lines: Line[] = [[]];
  let used = 0;
  for (const word of words) {
    const visible = word.text.trimEnd().length;
    if (used > 0 && used + visible > width) {
      lines.push([]);
      used = 0;
    }
    lines.at(-1)!.push(word);
    used += word.text.length;
  }
  return lines.map((line) => {
    const last = line.at(-1);
    if (last) line[line.length - 1] = { ...last, text: last.text.trimEnd() };
    return line;
  });
}

function styled(lines: Line[]): StyledText {
  const chunks: TextChunk[] = [];
  lines.forEach((line, i) => {
    if (i > 0) chunks.push(fg(palette.ink)("\n"));
    for (const s of line) chunks.push(s.strong ? bold(fg(s.color)(s.text)) : fg(s.color)(s.text));
  });
  return new StyledText(chunks);
}

const width = (line: Line) => line.reduce((n, s) => n + s.text.length, 0);
const quote = (claim: Claim) => (claim.quoted ? `“${claim.text}”` : claim.text);

// Hanging indent: the label column stays fixed, text and note wrap under the claim text.
function claimBlock(head: Segment[], body: Segment[], rest: Segment[], paneWidth: number, marker: Segment): Line[] {
  const textWidth = paneWidth - TEXT_COL;
  const indent = seg(" ".repeat(LABEL_COL), palette.ink);
  const pad = seg(" ".repeat(LABEL_COL - width(head)), palette.ink);
  const first = wrap(body, textWidth).map((line, i) => [marker, ...(i === 0 ? [...head, pad] : [indent]), ...line]);
  const second = wrap(rest, textWidth).map((line) => [marker, indent, ...line]);
  // Padded to the pane width so a focused block's background is one even band.
  return [...first, ...second].map((line) => [...line, seg(" ".repeat(Math.max(0, paneWidth - width(line))), palette.ink)]);
}

function resolvedBlock(claim: Claim, paneWidth: number, focused: boolean): Line[] {
  const v = verdicts[claim.verdict];
  return claimBlock(
    [seg(`${v.glyph} ${v.label}`, v.color)],
    [seg(quote(claim), palette.ink)],
    [seg(`${claim.note}  `, palette.body), { ...seg(cite(claim.evidence), palette.dim), keep: true }],
    paneWidth,
    seg(focused ? MARKER : " ".repeat(MARKER.length), v.color),
  );
}

function scanningBlock(claim: Claim, paneWidth: number, spinner: string): Line[] {
  return claimBlock(
    [seg(spinner, palette.arg), seg(" checking", palette.dim)],
    [seg(quote(claim), palette.ink)],
    [seg(`matching against ${label.sentences} label sentences`, palette.dim)],
    paneWidth,
    seg(" ".repeat(MARKER.length), palette.dim),
  );
}

function detailLines(claim: Claim, paneWidth: number): Line[] {
  const e = claim.evidence;
  if (e.kind === "rule") {
    return [[seg(`rule ${e.rule}`, palette.dim)], ...wrap([seg(e.text, palette.body)], paneWidth)];
  }
  return [
    [seg(`${e.ref} · ${e.section}`, palette.dim)],
    ...wrap([seg(e.before, palette.body), seg(e.span, palette.ink, true), seg(e.after, palette.body)], paneWidth),
    ...(e.aside ? wrap([seg(e.aside, palette.dim)], paneWidth) : []),
  ];
}

function statusLine(view: View): Line {
  const spin = seg(`${view.spinner} `, palette.arg);
  switch (view.phase) {
    case "reading":
      return [spin, seg("reading piece", palette.dim)];
    case "extracting":
      return [spin, seg(`extracting claims · ${claims.length} found`, palette.dim)];
    case "checking":
    case "done":
      return [seg(`${claims.length} claims extracted`, palette.dim)];
  }
}

function summaryLine(): Line {
  const sep = seg(" · ", palette.dim);
  return [
    ...summary.flatMap((s, i) => [...(i > 0 ? [sep] : []), seg(s.text, tones[s.tone].color)]),
    sep,
    seg(`exit ${exitCode}`, palette.dim),
  ];
}

type Box = { left: number; top: number; width: number; height: number };

export type Geometry = {
  image: Box;
  pane: { left: number; width: number };
  claimTops: number[];
  summaryTop: number;
  detailTop: number;
  detailWidth: number;
};

// Each claim's slot is sized for its resolved form so rows never shift as claims resolve.
export function geometry(cols: number, rows: number): Geometry {
  let imageWidth = Math.min(Math.round(cols * IMAGE_SHARE), cols - 2 * MARGIN_X - PANE_GAP - MIN_PANE);
  let imageHeight = Math.round((imageWidth * IMAGE_SIZE.height) / IMAGE_SIZE.width / 2);
  const maxHeight = rows - CONTENT_Y - 1 - DETAIL_ROWS - 1;
  if (imageHeight > maxHeight) {
    imageHeight = maxHeight;
    imageWidth = Math.round((imageHeight * 2 * IMAGE_SIZE.width) / IMAGE_SIZE.height);
  }
  const paneLeft = MARGIN_X + imageWidth + PANE_GAP;
  const paneWidth = cols - MARGIN_X - paneLeft;
  const claimTops: number[] = [];
  let y = CONTENT_Y + 2;
  for (const claim of claims) {
    claimTops.push(y);
    y += resolvedBlock(claim, paneWidth, false).length + 1;
  }
  const detailTop = Math.max(CONTENT_Y + imageHeight, y + 1) + 1;
  return {
    image: { left: MARGIN_X, top: CONTENT_Y, width: imageWidth, height: imageHeight },
    pane: { left: paneLeft, width: paneWidth },
    claimTops,
    summaryTop: y,
    detailTop,
    detailWidth: cols - 2 * MARGIN_X,
  };
}

export type Size = { width: number; height: number };
type Rect = { x0: number; y0: number; x1: number; y1: number };
const PAD = 4;

// Padding, stroke, and corner radius are in source pixels so the outline keeps its proportions
// whether the image is drawn at 2x2 pixels per cell (blocks) or at the terminal's real pixels.
// Blocks pixels are twice as tall as wide, so x and y scale separately.
export function outlineFor(size: Size, region: Region): Rect {
  const sx = size.width / IMAGE_SIZE.width;
  const sy = size.height / IMAGE_SIZE.height;
  const padX = Math.max(1, Math.round(PAD * sx));
  const padY = Math.max(1, Math.round(PAD * sy));
  return {
    x0: Math.max(0, Math.round(region.x0 * sx) - padX),
    y0: Math.max(0, Math.round(region.y0 * sy) - padY),
    x1: Math.min(size.width - 1, Math.round(region.x1 * sx) + padX),
    y1: Math.min(size.height - 1, Math.round(region.y1 * sy) + padY),
  };
}

export const strokeFor = (size: Size) => Math.max(1, Math.round((3 * size.width) / IMAGE_SIZE.width));

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];

// The outline is drawn into the image's pixels: cells printed over a sixel or kitty image
// replace the image in those cells, and over blocks they cover it with flat color.
function strokeRect(data: Uint8Array, stride: number, rect: Rect, color: string, stroke: number, radius: number) {
  const [r, g, b] = rgb(color);
  const cx = (rect.x0 + rect.x1 + 1) / 2;
  const cy = (rect.y0 + rect.y1 + 1) / 2;
  const hw = (rect.x1 - rect.x0 + 1 - stroke) / 2 - radius;
  const hh = (rect.y1 - rect.y0 + 1 - stroke) / 2 - radius;
  for (let y = rect.y0; y <= rect.y1; y++) {
    for (let x = rect.x0; x <= rect.x1; x++) {
      const qx = Math.abs(x + 0.5 - cx) - hw;
      const qy = Math.abs(y + 0.5 - cy) - hh;
      const d = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - radius;
      const a = Math.min(1, Math.max(0, stroke / 2 + 0.5 - Math.abs(d)));
      if (a === 0) continue;
      const at = y * stride + x * 4;
      data[at] = Math.round(data[at]! + (r - data[at]!) * a);
      data[at + 1] = Math.round(data[at + 1]! + (g - data[at + 1]!) * a);
      data[at + 2] = Math.round(data[at + 2]! + (b - data[at + 2]!) * a);
    }
  }
}

export function outlinedImage(source: NativeImage, size: Size, claim: Claim | null): NativeImage {
  const resized = source.resize({ ...size, kernel: "area" });
  const raw = resized.raw("rgba8");
  const data = raw.data.slice();
  resized.dispose();
  if (claim?.region) {
    const radius = Math.round((9 * size.width) / IMAGE_SIZE.width);
    strokeRect(data, raw.stride, outlineFor(size, claim.region), verdicts[claim.verdict].color, strokeFor(size), radius);
  }
  return NativeImage.fromRgba(data, size.width, size.height, raw.stride);
}

export async function createScene(renderer: CliRenderer, imagePath: string) {
  const source = await NativeImage.load(imagePath);
  const text = () => new TextRenderable(renderer, { position: "absolute", wrapMode: "none" });

  const command = text();
  const labelInfo = text();
  const image = new ImageRenderable(renderer, { position: "absolute", protocol: (process.env.OPENLABEL_IMAGE_PROTOCOL ?? "auto") as ImageRenderProtocol, fit: "fill" });
  const status = text();
  const claimRows = claims.map(() => text());
  const summaryRow = text();
  const rule = text();
  const detail = text();
  for (const r of [command, labelInfo, image, status, ...claimRows, summaryRow, rule, detail]) renderer.root.add(r);

  command.content = styled([
    [
      seg("❯ ", palette.dim),
      seg("openlabel check", palette.ink),
      seg(` ${piece} --label ${label.name}`, palette.arg),
    ],
  ]);
  const labelLine = [seg(`${label.title} · ${label.sentences} sentences`, palette.dim)];
  labelInfo.content = styled([labelLine]);
  summaryRow.content = styled([summaryLine()]);

  let g = geometry(renderer.width, renderer.height);
  let view: View | null = null;
  let painted = "";

  // The size OpenTUI will draw the image at, so the outline lands on whole pixels.
  function pixelSize(): Size {
    const res = renderer.resolution;
    if (!res || image.effectiveProtocol === "blocks") return { width: g.image.width * 2, height: g.image.height * 2 };
    return {
      width: Math.round((g.image.width * res.width) / renderer.terminalWidth),
      height: Math.round((g.image.height * res.height) / renderer.terminalHeight),
    };
  }

  // Cheap when nothing changed, so it runs every frame: the pixel size arrives after startup
  // and after each terminal resize, when the terminal answers OpenTUI's size query.
  function paint() {
    const size = pixelSize();
    const focus = view?.focus ?? null;
    const key = `${size.width}x${size.height}:${focus}`;
    if (key === painted) return;
    painted = key;
    const next = outlinedImage(source, size, focus === null ? null : claims[focus]!);
    image.source = next;
    next.dispose();
  }

  const place = (r: Renderable, box: Box) => Object.assign(r, box);

  function layout(cols: number, rows: number) {
    g = geometry(cols, rows);
    place(command, { left: MARGIN_X, top: HEADER_Y, width: cols - 2 * MARGIN_X, height: 1 });
    place(labelInfo, { left: cols - MARGIN_X - width(labelLine), top: HEADER_Y, width: width(labelLine), height: 1 });
    place(image, g.image);
    paint();
    place(status, { left: g.pane.left, top: CONTENT_Y, width: g.pane.width, height: 1 });
    claimRows.forEach((r, i) => {
      const next = g.claimTops[i + 1] ?? g.summaryTop;
      place(r, { left: g.pane.left, top: g.claimTops[i]!, width: g.pane.width, height: next - g.claimTops[i]! - 1 });
    });
    place(summaryRow, { left: g.pane.left + TEXT_COL - LABEL_COL, top: g.summaryTop, width: g.pane.width, height: 1 });
    place(rule, { left: MARGIN_X, top: g.detailTop, width: g.detailWidth, height: 1 });
    rule.content = styled([[seg("─".repeat(g.detailWidth), palette.line)]]);
    place(detail, { left: MARGIN_X, top: g.detailTop + 1, width: g.detailWidth, height: Math.max(1, rows - g.detailTop - 1) });
    if (view) apply(view);
  }

  function apply(next: View) {
    view = next;
    status.content = styled([statusLine(next)]);
    claimRows.forEach((r, i) => {
      const claim = claims[i]!;
      if (i < next.resolved) {
        r.visible = true;
        r.content = styled(resolvedBlock(claim, g.pane.width, next.focus === i));
        r.bg = next.focus === i ? palette.surface : palette.bg;
      } else if (i === next.scanning) {
        r.visible = true;
        r.content = styled(scanningBlock(claim, g.pane.width, next.spinner));
        r.bg = palette.bg;
      } else {
        r.visible = false;
      }
    });
    summaryRow.visible = next.phase === "done";
    const focused = next.focus === null ? null : claims[next.focus]!;
    rule.visible = detail.visible = focused !== null;
    if (focused) detail.content = styled(detailLines(focused, g.detailWidth));
    paint();
  }

  layout(renderer.width, renderer.height);
  await image.loadPromise;
  return { apply, layout, paint, image, geometry: () => g };
}
