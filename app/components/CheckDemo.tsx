"use client";

import Image from "next/image";
import { useState } from "react";
import { claims, labelExcerpt, verdictTone } from "../content";

const sentences = new Map(
  labelExcerpt.flatMap((section) => section.sentences.map((s) => [s.id, { heading: section.heading, text: s.text }])),
);

export function CheckDemo() {
  const [activeId, setActiveId] = useState(claims[0].id);
  const active = claims.find((c) => c.id === activeId) ?? claims[0];
  const tone = verdictTone[active.verdict];
  const evidence = active.sentence ? sentences.get(active.sentence) : undefined;

  return (
    <div className="check-demo">
      <div className="creative">
        <Image
          src="/images/lorvexa-ad.png"
          alt="A print ad for Lorvexa: the headline Live clear above two hikers seen from behind, arms raised, in a golden field below mountains"
          width={1200}
          height={800}
          sizes="(max-width: 900px) 100vw, 60vw"
        />
        {claims.map((c) => (
          <button
            key={c.id}
            type="button"
            aria-label={`${c.verdict}: ${c.text}`}
            className={`box tone-${verdictTone[c.verdict]}${c.id === activeId ? " on" : ""}${c.verdict === "missing" ? " dashed" : ""}`}
            style={{ left: `${c.box.left}%`, top: `${c.box.top}%`, width: `${c.box.width}%`, height: `${c.box.height}%` }}
            onMouseEnter={() => setActiveId(c.id)}
            onFocus={() => setActiveId(c.id)}
            onClick={() => setActiveId(c.id)}
          />
        ))}
      </div>

      <div className="check-side">
        <ol className="claim-rows">
          {claims.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                className={c.id === activeId ? "on" : undefined}
                onMouseEnter={() => setActiveId(c.id)}
                onFocus={() => setActiveId(c.id)}
                onClick={() => setActiveId(c.id)}
              >
                <span className={`verdict t-${verdictTone[c.verdict]}`}>{c.verdict}</span>
                <span className="claim-text">
                  {c.quoted ? `“${c.text}”` : c.text}
                </span>
                <span className="claim-cite">{c.cite}</span>
              </button>
            </li>
          ))}
        </ol>

        <div className="evidence">
          {evidence ? (
            <div className="paper">
              <p className="paper-heading">
                {evidence.heading}
                <span>Lorvexa label, rev 06/2026</span>
              </p>
              <p>
                <mark className={`tone-${tone}`}>{evidence.text}</mark>
              </p>
            </div>
          ) : null}
          <p className="evidence-note">{active.note}</p>
        </div>
      </div>
    </div>
  );
}
