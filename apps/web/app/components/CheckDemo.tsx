"use client";

import { ad, cite, claims, type Evidence } from "@openlabel/lorvexa";
import Image from "next/image";
import { useState } from "react";
import { verdictTone } from "../content";

function EvidenceQuote({ evidence, tone }: { evidence: Evidence; tone: string }) {
  if (evidence.kind === "rule") return <blockquote className={`tone-${tone}`}>{evidence.text}</blockquote>;
  return (
    <blockquote className={`tone-${tone}`}>
      {evidence.before}
      <strong>{evidence.span}</strong>
      {evidence.after}
    </blockquote>
  );
}

export function CheckDemo() {
  const [activeId, setActiveId] = useState(claims[0]!.id);
  const active = claims.find((c) => c.id === activeId) ?? claims[0]!;

  return (
    <div className="check-demo">
      <div className="creative">
        <Image
          src={ad.src}
          alt="A print ad for Lorvexa: the headline Live clear above two hikers seen from behind, arms raised, in a golden field below mountains"
          width={ad.width}
          height={ad.height}
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
          return (
            <li key={c.id} className={on ? "on" : undefined}>
              <button type="button" aria-expanded={on} onClick={() => setActiveId(c.id)}>
                <span className={`verdict t-${verdictTone[c.verdict]}`}>{c.verdict}</span>
                <span className="claim-text">{c.quoted ? `“${c.text}”` : c.text}</span>
                <span className="claim-cite">{cite(c.evidence)}</span>
              </button>
              {on ? (
                <div className="claim-detail">
                  <p>{c.note}</p>
                  <EvidenceQuote evidence={c.evidence} tone={verdictTone[c.verdict]} />
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
