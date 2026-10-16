import type { ReactNode } from "react";
import { BlastRadius } from "./components/BlastRadius";
import { CheckDemo } from "./components/CheckDemo";
import { CopyCommand } from "./components/CopyCommand";
import { DemoWindow } from "./components/DemoWindow";
import { UnseenExplorer } from "./components/UnseenExplorer";
import { github, labelDiff, skills, unseenQueries } from "./content";
import { stateMap } from "./geo";

function Mark() {
  return (
    <svg className="mark" viewBox="0 0 26 26" aria-hidden="true">
      <rect x="1" y="1" width="24" height="24" rx="7" fill="#f5f5f7" />
      <rect x="6" y="9" width="14" height="2.2" rx="1.1" fill="#000" />
      <rect x="6" y="14" width="9" height="2.2" rx="1.1" fill="#000" opacity="0.45" />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg className="gh" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}

function SectionHead({ name, command, title, children }: { name: string; command: string; title: string; children: ReactNode }) {
  return (
    <div className="sec-head">
      <div className="sec-tag">
        <span>{name}</span>
        <code>{command}</code>
      </div>
      <h2>
        {title} <span className="rest">{children}</span>
      </h2>
    </div>
  );
}

export default function Home() {
  const maps = unseenQueries.map((q) => stateMap(q));

  return (
    <div className="page">
      <header className="site-head rail">
        <Mark />
        <span className="name">Open Label</span>
        <nav>
          <a href="#check">Check</a>
          <a href="#watch">Watch</a>
          <a href="#unseen">Unseen</a>
          <a href="#skills">Skills</a>
          <a href={github}>GitHub</a>
        </nav>
      </header>

      <section className="hero rail">
        <h1>
          Open tools that keep every message to a doctor true to the FDA label.{" "}
          <span className="rest">
            Claim checks, label-change tracking, public-data HCP discovery and agent skills, for the teams that write
            to physicians and the reviewers who sign off.
          </span>
        </h1>
        <div className="buttons">
          <CopyCommand command="npx openlabel check promo.html --label lorvexa" />
          <a className="btn" href={github}>
            <GitHubIcon />
            View on GitHub
          </a>
        </div>
      </section>

      <div className="demo rail">
        <DemoWindow />
      </div>

      <section className="sec rail" id="check">
        <SectionHead name="Check" command="openlabel check" title="Every claim, traced to a sentence in the label.">
          Pick one to see the evidence.
        </SectionHead>
        <CheckDemo />
      </section>

      <section className="sec rail" id="watch">
        <SectionHead name="Watch" command="openlabel watch" title="A label change has a blast radius.">
          Watch finds the approved claims it broke and drafts the fixes.
        </SectionHead>
        <div className="watch">
          <div className="diff">
            <div className="diff-head">
              <span>Lorvexa label</span>
              <code>rev 03/2026 to 06/2026</code>
            </div>
            {labelDiff.map((block) => (
              <div className="diff-block" key={block.section}>
                <p className="diff-section">{block.section}</p>
                {block.lines.map((line, i) => (
                  <p key={i} className={`diff-line ${line.kind}`}>
                    <span className="sign">{line.kind === "add" ? "+" : line.kind === "del" ? "−" : " "}</span>
                    {line.text}
                  </p>
                ))}
              </div>
            ))}
            <p className="diff-foot">
              4 fixes drafted and rechecked, <span className="t-ok">4 pass</span>
            </p>
          </div>
          <div className="blast-wrap">
            <BlastRadius />
          </div>
        </div>
      </section>

      <section className="sec rail" id="unseen">
        <SectionHead name="Unseen" command="openlabel unseen" title="Find the doctors nobody calls on.">
          Built only from NPPES, CMS Part D, Open Payments and ClinicalTrials.gov.
        </SectionHead>
        <UnseenExplorer maps={maps} />
      </section>

      <section className="sec rail" id="skills">
        <SectionHead name="Skills" command="claude plugin install openlabel-skills" title="Agent skills for medical affairs.">
          Each ships with the eval suite that grades it.
        </SectionHead>
        <div className="skills">
          {skills.map((s) => {
            const rate = (s.pass / s.cases) * 100;
            return (
              <div className="skill" key={s.name}>
                <code>{s.name}</code>
                <span className="skill-summary">{s.summary}</span>
                <span className="bar">
                  <span style={{ width: `${rate}%` }} />
                </span>
                <span className="skill-rate">{Number(rate.toFixed(1))}%</span>
                <span className="skill-cases">
                  {s.pass}/{s.cases}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="closing rail">
        <h2>
          Built for MLR reviewers, not around them.{" "}
          <span className="rest">
            Open Label drafts and flags, a person signs off, and every verdict links to its evidence. Free and open
            source.
          </span>
        </h2>
        <div className="buttons">
          <CopyCommand command="npm install -g openlabel" />
          <a className="btn primary" href={github}>
            Get Open Label on GitHub
            <svg className="arrow" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path d="M3 8h9M8.5 4.5 12 8l-3.5 3.5" />
            </svg>
          </a>
        </div>
      </section>

      <footer className="rail">
        <p className="fine">
          Open Label is free and MIT licensed, made by <a href="https://github.com/amanibobo">Amani Bobo</a> · Not
          affiliated with FDA.
        </p>
      </footer>
    </div>
  );
}
