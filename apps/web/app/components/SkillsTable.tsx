"use client";

import { useState } from "react";
import type { SkillRow } from "../skills";

export function SkillsTable({ rows, ranAt }: { rows: SkillRow[]; ranAt: string }) {
  const [open, setOpen] = useState<string | null>(null);
  const date = new Date(ranAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });

  return (
    <>
      <div className="skills">
        {rows.map((s) => {
          const rate = s.total ? (s.passed / s.total) * 100 : 0;
          const on = open === s.name;
          return (
            <div className={`skill-row${on ? " on" : ""}`} key={s.name}>
              <button type="button" className="skill" aria-expanded={on} onClick={() => setOpen(on ? null : s.name)}>
                <code>{s.name}</code>
                <span className="skill-summary">{s.summary}</span>
                <span className="bar">
                  <span style={{ width: `${rate}%` }} />
                </span>
                <span className="skill-rate">{Number(rate.toFixed(1))}%</span>
                <span className="skill-cases">
                  {s.passed}/{s.total}
                </span>
              </button>
              {on ? (
                <ul className="skill-evals">
                  {s.cases.map((c) => (
                    <li key={c.id}>
                      <span className={c.passed ? "t-ok" : "t-bad"}>{c.passed ? "✓" : "✗"}</span>
                      <code>{c.id}</code>
                      <span>{c.prompt}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          );
        })}
      </div>
      <p className="skills-foot">Eval run of {date}. Pick a skill to see its cases.</p>
    </>
  );
}
