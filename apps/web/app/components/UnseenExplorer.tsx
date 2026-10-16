"use client";

import { useState } from "react";
import { unseenQueries } from "../content";
import type { StateMap } from "../geo";

export function UnseenExplorer({ maps }: { maps: StateMap[] }) {
  const [active, setActive] = useState(0);
  const [hovered, setHovered] = useState<number | null>(null);
  const q = unseenQueries[active];
  const map = maps[active];

  return (
    <div className="unseen">
      <div className="presets" role="tablist" aria-label="Example searches">
        {unseenQueries.map((preset, i) => (
          <button
            key={preset.label}
            type="button"
            role="tab"
            aria-selected={i === active}
            className={i === active ? "on" : undefined}
            onClick={() => {
              setActive(i);
              setHovered(null);
            }}
          >
            {preset.label}
          </button>
        ))}
      </div>

      <div className="query">
        <span className="p">❯</span>
        <span>{q.query}</span>
      </div>

      <div className="unseen-grid">
        <svg
          className="state-map"
          viewBox={`0 0 ${map.width} ${map.height}`}
          role="img"
          aria-label={`County map with ${q.rows.length} matching prescribers`}
        >
          {map.counties.map((c) => (
            <path key={c.id} d={c.d} className={c.hit ? "county hit" : "county"} />
          ))}
          {map.points.map((p, i) => (
            <g key={p.place} className={hovered === null || hovered === i ? "pin" : "pin faded"}>
              <circle cx={p.x} cy={p.y} r={hovered === i ? 15 : 10} className="pin-halo" />
              <circle cx={p.x} cy={p.y} r={4.5} className="pin-dot" />
              <text x={p.x + 12} y={p.y + 4} className="pin-label">
                {p.place}
              </text>
            </g>
          ))}
        </svg>

        <div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>NPI</th>
                  <th>Specialty</th>
                  <th>Location</th>
                  <th className="num">{q.claimsLabel}</th>
                  <th className="num">Industry payments, 3 yrs</th>
                  <th className="num">Trials</th>
                </tr>
              </thead>
              <tbody>
                {q.rows.map((r, i) => (
                  <tr key={r.npi} onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}>
                    <td className="mono">{r.npi}</td>
                    <td>{r.specialty}</td>
                    <td>{r.place}</td>
                    <td className="num mono">{r.claims.toLocaleString("en-US")}</td>
                    <td className="num mono">{r.payments}</td>
                    <td className="num mono">{r.trials}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="panel-foot">
            {q.total} match, showing {q.rows.length}. Prescribing comes from CMS Part D, which runs about two years
            behind, so this view uses 2024 claims.
          </p>
        </div>
      </div>
    </div>
  );
}
