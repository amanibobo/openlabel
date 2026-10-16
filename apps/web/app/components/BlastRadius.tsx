import { blastPieces } from "../content";

const cx = 380;
const cy = 220;
const inner = 100;
const outer = 172;

function polar(r: number, deg: number) {
  const a = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

const changes = [
  { label: "§2.2 dosing", at: polar(inner, 200), pieces: ["hcp-email-0311.html", "dosing-calculator.json"] },
  { label: "§5.3 new warning", at: polar(inner, -20), pieces: ["sms-0412.md", "leave-behind-0207.pdf"] },
];

const pieceAngle: Record<string, number> = {
  "hcp-email-0311.html": 232,
  "dosing-calculator.json": 152,
  "sms-0412.md": -52,
  "leave-behind-0207.pdf": 28,
};

export function BlastRadius() {
  return (
    <svg className="blast" viewBox="40 36 680 370" role="img" aria-label="Blast radius of the Lorvexa label change: two changed sections reach four approved pieces and seven claims">
      <circle cx={cx} cy={cy} r={inner} className="ring" />
      <circle cx={cx} cy={cy} r={outer} className="ring" />

      {changes.map((c) => (
        <g key={c.label}>
          <line x1={cx} y1={cy} x2={c.at.x} y2={c.at.y} className="edge" />
          {c.pieces.map((file) => {
            const p = polar(outer, pieceAngle[file]);
            return <line key={file} x1={c.at.x} y1={c.at.y} x2={p.x} y2={p.y} className="edge" />;
          })}
        </g>
      ))}

      <circle cx={cx} cy={cy} r={40} className="core" />
      <text x={cx} y={cy - 4} className="core-text">
        Label
      </text>
      <text x={cx} y={cy + 13} className="core-sub">
        rev 06/2026
      </text>

      {changes.map((c) => (
        <g key={c.label}>
          <circle cx={c.at.x} cy={c.at.y} r={6} className="change" />
          <text
            x={c.at.x < cx ? c.at.x - 12 : c.at.x + 12}
            y={c.at.y + 4}
            textAnchor={c.at.x < cx ? "end" : "start"}
            className="change-text"
          >
            {c.label}
          </text>
        </g>
      ))}

      {blastPieces.map((piece) => {
        const p = polar(outer, pieceAngle[piece.file]);
        const left = p.x < cx;
        const tx = left ? p.x - 14 : p.x + 14;
        return (
          <g key={piece.file}>
            <circle cx={p.x} cy={p.y} r={6} className={`piece tone-${piece.severity}`} />
            <text x={tx} y={p.y - 3} textAnchor={left ? "end" : "start"} className="piece-file">
              {piece.file}
            </text>
            <text x={tx} y={p.y + 14} textAnchor={left ? "end" : "start"} className="piece-reason">
              {piece.claims} {piece.claims === 1 ? "claim" : "claims"}, {piece.reason}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
