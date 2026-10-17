"use client";

import { useState } from "react";
import { blastPieces, labelChanges } from "../content";

const cx = 380;
const cy = 220;
const inner = 100;
const outer = 172;

function polar(r: number, deg: number) {
  const a = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

const sideOf = (x: number) => (x < cx ? { anchor: "end" as const, dx: -1 } : { anchor: "start" as const, dx: 1 });

const claimCount = blastPieces.reduce((n, p) => n + p.claims, 0);

export function WatchDemo() {
  const [active, setActive] = useState<string | null>(null);
  const dim = (section: string) => (active !== null && active !== section ? " dim" : "");
  const hover = (section: string) => ({
    onMouseEnter: () => setActive(section),
    onMouseLeave: () => setActive(null),
    onFocus: () => setActive(section),
    onBlur: () => setActive(null),
  });

  return (
    <div className="watch">
      <div className="diff">
        <div className="diff-head">
          <span>Lorvexa label</span>
          <code>rev 03/2026 to 06/2026</code>
        </div>
        {labelChanges.map((change) => (
          <div key={change.section} className={`diff-block${dim(change.section)}`} tabIndex={0} {...hover(change.section)}>
            <p className="diff-section">
              {change.section} {change.title}
            </p>
            {change.lines.map((line, i) => (
              <p key={i} className={`diff-line ${line.kind}`}>
                <span className="sign">{line.kind === "add" ? "+" : line.kind === "del" ? "−" : " "}</span>
                {line.text}
              </p>
            ))}
          </div>
        ))}
        <p className="diff-foot">
          {blastPieces.length} fixes drafted and rechecked, <span className="t-ok">{blastPieces.length} pass</span>
        </p>
      </div>

      <div className="blast-wrap">
        <svg
          className="blast"
          viewBox="40 36 680 370"
          role="img"
          aria-label={`Blast radius of the Lorvexa label change: ${labelChanges.length} changed sections reach ${blastPieces.length} approved pieces and ${claimCount} claims`}
        >
          <circle cx={cx} cy={cy} r={inner} className="ring" />
          <circle cx={cx} cy={cy} r={outer} className="ring" />

          {labelChanges.map((change) => {
            const at = polar(inner, change.angle);
            return (
              <g key={change.section} className={`edges${dim(change.section)}`}>
                <line x1={cx} y1={cy} x2={at.x} y2={at.y} className="edge" />
                {blastPieces
                  .filter((p) => p.section === change.section)
                  .map((piece) => {
                    const p = polar(outer, piece.angle);
                    return <line key={piece.file} x1={at.x} y1={at.y} x2={p.x} y2={p.y} className="edge" />;
                  })}
              </g>
            );
          })}

          <circle cx={cx} cy={cy} r={40} className="core" />
          <text x={cx} y={cy - 4} className="core-text">
            Label
          </text>
          <text x={cx} y={cy + 13} className="core-sub">
            rev 06/2026
          </text>

          {labelChanges.map((change) => {
            const at = polar(inner, change.angle);
            const side = sideOf(at.x);
            return (
              <g key={change.section} className={`node${dim(change.section)}`} {...hover(change.section)}>
                <circle cx={at.x} cy={at.y} r={6} className="change" />
                <text x={at.x + side.dx * 12} y={at.y + 4} textAnchor={side.anchor} className="change-text">
                  §{change.section} {change.short}
                </text>
              </g>
            );
          })}

          {blastPieces.map((piece) => {
            const p = polar(outer, piece.angle);
            const side = sideOf(p.x);
            const tx = p.x + side.dx * 14;
            return (
              <g key={piece.file} className={`node${dim(piece.section)}`} tabIndex={0} {...hover(piece.section)}>
                <circle cx={p.x} cy={p.y} r={6} className={`piece tone-${piece.severity}`} />
                <text x={tx} y={p.y - 3} textAnchor={side.anchor} className="piece-file">
                  {piece.file}
                </text>
                <text x={tx} y={p.y + 14} textAnchor={side.anchor} className="piece-reason">
                  {piece.claims} {piece.claims === 1 ? "claim" : "claims"}, {piece.reason}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
