"use client";

import Image from "next/image";
import { useState } from "react";
import { claims, labelSentences, verdictTone } from "../content";

export function CheckDemo() {
  const [activeId, setActiveId] = useState(claims[0].id);
  const active = claims.find((c) => c.id === activeId) ?? claims[0];

  return (
    <div className="check-demo">
      <div className="creative">
        <Image
          src="/images/lorvexa-ad.png"
          alt="A print ad for Lorvexa: the headline Live clear above two hikers seen from behind, arms raised, in a golden field below mountains"
          width={1200}
          height={800}
          sizes="(max-width: 900px) 100vw, 45vw"
        />
        <span
          key={active.id}
          className={`box tone-${verdictTone[active.verdict]}${active.verdict === "missing" ? " dashed" : ""}`}
          style={{
            left: `${active.box.left}%`,
            top: `${active.box.top}%`,
            width: `${active.box.width}%`,
            height: `${active.box.height}%`,
          }}
        />
      </div>

      <ol className="claims">
        {claims.map((c) => {
          const on = c.id === activeId;
          const sentence = c.sentence ? labelSentences[c.sentence] : undefined;
          return (
            <li key={c.id} className={on ? "on" : undefined}>
              <button type="button" aria-expanded={on} onClick={() => setActiveId(c.id)}>
                <span className={`verdict t-${verdictTone[c.verdict]}`}>{c.verdict}</span>
                <span className="claim-text">{c.quoted ? `“${c.text}”` : c.text}</span>
                <span className="claim-cite">{c.cite}</span>
              </button>
              {on ? (
                <div className="claim-detail">
                  <p>{c.note}</p>
                  {sentence ? <blockquote className={`tone-${verdictTone[c.verdict]}`}>{sentence}</blockquote> : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
