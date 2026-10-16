import type { ReactNode } from "react";
import type { Line } from "../content";

export function renderLines(lines: readonly Line[]): ReactNode[] {
  return lines.map((line, i) => (
    <span key={i}>
      {line.map(([tone, text], j) => (
        <span key={j} className={`t-${tone}`}>
          {text}
        </span>
      ))}
      {i < lines.length - 1 ? "\n" : null}
    </span>
  ));
}

export function Window({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="term">
      <div className="term-head">
        <span className="dots">
          <i />
          <i />
          <i />
        </span>
        <span className="term-title">{title}</span>
      </div>
      <div className="term-body">{children}</div>
    </div>
  );
}
