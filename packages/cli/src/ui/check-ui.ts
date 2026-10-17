import { createCliRenderer, StyledText, TextRenderable, bold, fg, type KeyEvent, type TextChunk } from "@opentui/core";
import type { Progress, Report } from "@openlabel/check";
import { claimList, detail, findingLines, footer, header, initialState, move, palette, type CheckState, type Line } from "./view.ts";

const SPINNER = "⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏";
const MARGIN = 2;
const GAP = 3;

function styled(lines: Line[]): StyledText {
  const chunks: TextChunk[] = [];
  lines.forEach((line, i) => {
    if (i > 0) chunks.push(fg(palette.ink)("\n"));
    for (const s of line) chunks.push(s.strong ? bold(fg(s.color)(s.text)) : fg(s.color)(s.text));
  });
  return new StyledText(chunks);
}

export type RunCheck = (hooks: { label: (title: string) => void; progress: (p: Progress) => void }) => Promise<Report>;

// Runs the check inside an OpenTUI screen. Resolves once the person quits, with the
// report if the check finished.
export async function checkUi(file: string, labelQuery: string, runCheck: RunCheck): Promise<{ report: Report | null; error: string | null }> {
  const renderer = await createCliRenderer({ targetFps: 30, backgroundColor: palette.bg, exitOnCtrlC: false });
  renderer.setBackgroundColor(palette.bg);

  const text = () => new TextRenderable(renderer, { position: "absolute", wrapMode: "none" });
  const [top, ruleTop, list, side, findings, ruleBottom, bottom] = [text(), text(), text(), text(), text(), text(), text()];
  for (const r of [top, ruleTop, list, side, findings, ruleBottom, bottom]) renderer.root.add(r);

  let state: CheckState = initialState(file, labelQuery);
  let report: Report | null = null;
  let frame = 0;

  const paint = () => {
    const cols = renderer.width;
    const rows = renderer.height;
    const inner = cols - 2 * MARGIN;
    const listWidth = Math.max(36, Math.min(64, Math.floor(inner * 0.42)));
    const sideLeft = MARGIN + listWidth + GAP;
    const sideWidth = Math.max(20, cols - sideLeft - MARGIN);
    const findingRows = findingLines(state, inner);
    const bodyTop = 3;
    const bodyBottom = rows - 3 - (findingRows.length ? findingRows.length + 1 : 0);
    const bodyHeight = Math.max(1, bodyBottom - bodyTop);

    Object.assign(top, { left: MARGIN, top: 1, width: inner, height: 1 });
    Object.assign(ruleTop, { left: MARGIN, top: 2, width: inner, height: 1 });
    Object.assign(list, { left: MARGIN, top: bodyTop, width: listWidth, height: bodyHeight });
    Object.assign(side, { left: sideLeft, top: bodyTop, width: sideWidth, height: bodyHeight });
    Object.assign(findings, { left: MARGIN, top: bodyBottom + 1, width: inner, height: findingRows.length });
    Object.assign(ruleBottom, { left: MARGIN, top: rows - 3, width: inner, height: 1 });
    Object.assign(bottom, { left: MARGIN, top: rows - 2, width: inner, height: 1 });

    const rule: Line[] = [[{ text: "─".repeat(inner), color: palette.line }]];
    top.content = styled([header(state)]);
    ruleTop.content = styled(rule);
    list.content = styled(claimList(state, listWidth).slice(0, bodyHeight));
    const sideLines = detail(state, sideWidth);
    side.content = styled(sideLines.length > bodyHeight ? [...sideLines.slice(0, bodyHeight - 1), [{ text: "…", color: palette.dim }]] : sideLines);
    findings.content = styled(findingRows);
    ruleBottom.content = styled(rule);
    bottom.content = styled([footer(state, SPINNER[frame % SPINNER.length]!)]);
  };

  const update = (next: Partial<CheckState>) => {
    state = { ...state, ...next };
    paint();
  };

  renderer.on("resize", paint);
  renderer.setFrameCallback(async () => {
    if (state.phase !== "done" && state.phase !== "failed") {
      frame++;
      paint();
    }
  });

  const quit = new Promise<void>((resolve) => {
    renderer.keyInput.on("keypress", (key: KeyEvent) => {
      if (key.name === "q" || key.name === "escape" || (key.ctrl && key.name === "c")) resolve();
      else if (key.name === "down" || key.name === "j") update(move(state, 1));
      else if (key.name === "up" || key.name === "k") update(move(state, -1));
    });
  });

  paint();
  renderer.start();

  runCheck({
    label: (title) => update({ label: title }),
    progress: (p) => {
      if (p.phase === "extracting") update({ phase: "extracting" });
      else {
        // Judged claims arrive out of order; keep them in the order they appear in the piece.
        const claims = p.claim ? [...state.claims, p.claim].sort((a, b) => a.start - b.start) : state.claims;
        update({ phase: "judging", total: p.total, claims });
      }
    },
  })
    .then((done) => {
      report = done;
      update({ phase: "done", claims: done.claims, findings: done.findings, exitCode: done.exitCode });
      renderer.auto();
    })
    .catch((error: Error) => {
      update({ phase: "failed", error: error.message });
      renderer.auto();
    });

  await quit;
  renderer.destroy();
  await renderer.closed;
  return { report, error: state.error };
}
