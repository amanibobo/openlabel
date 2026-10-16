"use client";

import { useEffect, useRef, useState } from "react";
import { promptLine, type Line, type Session } from "../content";
import { renderLines, Window } from "./Terminal";

type Phase =
  | { kind: "idle" }
  | { kind: "typing"; typed: number }
  | { kind: "printing"; printed: number }
  | { kind: "done" };

export function TypedTerminal({ session }: { session: Session }) {
  const ref = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const full = `${session.command} ${session.args}`;

  useEffect(() => {
    const io = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      io.disconnect();
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        setPhase({ kind: "done" });
      } else {
        setTimeout(() => setPhase({ kind: "typing", typed: 0 }), 500);
      }
    });
    if (ref.current) io.observe(ref.current);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (phase.kind === "typing") {
      const next: Phase =
        phase.typed < full.length ? { kind: "typing", typed: phase.typed + 1 } : { kind: "printing", printed: 0 };
      const delay = phase.typed < full.length ? 16 + Math.random() * 40 : 360;
      const t = setTimeout(() => setPhase(next), delay);
      return () => clearTimeout(t);
    }
    if (phase.kind === "printing") {
      const next: Phase =
        phase.printed < session.output.length
          ? { kind: "printing", printed: phase.printed + 1 }
          : { kind: "done" };
      const t = setTimeout(() => setPhase(next), session.output[phase.printed]?.length ? 140 : 60);
      return () => clearTimeout(t);
    }
  }, [phase, full.length, session.output]);

  const typedLine: Line = phase.kind === "typing" ? [["p", "❯ "], ["cmd", full.slice(0, phase.typed)]] : [["p", "❯ "]];
  const command = promptLine(session.command, session.args);

  let lines: Line[];
  switch (phase.kind) {
    case "idle":
    case "typing":
      lines = [typedLine];
      break;
    case "printing":
      lines = [command, ...session.output.slice(0, phase.printed)];
      break;
    case "done":
      lines = [command, ...session.output, [["p", "❯ "]]];
      break;
  }

  const caretOnLast = phase.kind !== "printing";

  return (
    <div ref={ref}>
      <Window title={session.title}>
        <pre style={{ minHeight: `${(session.output.length + 2) * 1.8}em` }} aria-label={`A terminal session running ${full}`}>
          {renderLines(lines)}
          {caretOnLast ? <span className="caret" /> : null}
        </pre>
      </Window>
    </div>
  );
}
