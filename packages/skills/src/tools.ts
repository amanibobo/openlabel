import { check, FDA_CORE, loadPack, retriever, type ClaimModel } from "@openlabel/check";
import { cite, type DailyMed } from "@openlabel/label";
import { diffDrugLabel } from "@openlabel/watch";

export type OpenLabelTools = {
  check(input: { piece: string; drug: string; rules?: string | undefined }): Promise<string>;
  search(input: { drug: string; question: string; limit?: number | undefined }): Promise<string>;
  diff(input: { drug: string; from?: number | undefined; to?: number | undefined }): Promise<string>;
};

export function openLabelTools(deps: { dailyMed: DailyMed; model: ClaimModel; packs?: Record<string, string> }): OpenLabelTools {
  const packFor = (name: string | undefined) => {
    if (!name) return FDA_CORE;
    const yaml = deps.packs?.[name];
    if (!yaml) throw new Error(`unknown rule pack ${name}; available: ${Object.keys(deps.packs ?? {}).join(", ") || "none"}`);
    return loadPack(yaml);
  };

  return {
    async check({ piece, drug, rules }) {
      const label = await deps.dailyMed.resolve(drug);
      const report = await check({ piece, label, model: deps.model, pack: packFor(rules) });
      return JSON.stringify({
        label: report.label,
        claims: report.claims.map((c) => ({
          text: c.text,
          verdict: c.verdict,
          reason: c.reason,
          evidence: c.evidenceText.map((s) => ({ cite: cite(s), text: s.text })),
        })),
        findings: report.findings,
        exitCode: report.exitCode,
      });
    },
    async search({ drug, question, limit }) {
      const label = await deps.dailyMed.resolve(drug);
      const hits = retriever(label)(question, "other", limit ?? 8);
      return JSON.stringify({
        label: { title: label.title, version: label.version },
        sentences: hits.map((s) => ({ cite: cite(s), text: s.context ? `(${s.context}) ${s.text}` : s.text })),
      });
    },
    async diff({ drug, from, to }) {
      const diff = await diffDrugLabel(deps.dailyMed, drug, { from, to });
      return JSON.stringify({
        title: diff.title,
        from: diff.from,
        to: diff.to,
        sections: diff.sections.map((s) => ({
          section: s.section,
          title: s.title,
          category: s.category,
          status: s.status,
          changes: s.changes.map((c) => ({
            kind: c.kind,
            ...(c.kind !== "added" && { before: c.before.text }),
            ...(c.kind !== "removed" && { after: c.after.text }),
          })),
        })),
      });
    },
  };
}
