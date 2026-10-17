import type { ReactNode } from "react";

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
