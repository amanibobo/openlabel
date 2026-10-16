import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseSpl } from "../src/spl.ts";
import { allSentences, type Section } from "../src/types.ts";

const xml = readFileSync(new URL("./fixtures/dupixent-v60.xml", import.meta.url), "utf8");
const label = parseSpl(xml);

function find(sections: readonly Section[], number: string): Section | undefined {
  for (const section of sections) {
    if (section.number === number) return section;
    const inner = find(section.subsections, number);
    if (inner) return inner;
  }
  return undefined;
}

describe("parseSpl on the Dupixent label", () => {
  it("reads the document identity", () => {
    expect(label.setId).toBe("595f437d-2729-40bb-9c62-c8ece1f82780");
    expect(label.version).toBe(60);
    expect(label.title).toBe("Dupixent (dupilumab)");
    expect(label.effectiveDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("builds the numbered section tree", () => {
    expect(label.sections.map((s) => s.number)).toEqual(
      expect.arrayContaining(["1", "2", "4", "5", "6", "14", "17"]),
    );
    const clinical = find(label.sections, "14");
    expect(clinical?.subsections.map((s) => s.number)).toContain("14.1");
    expect(find(label.sections, "14.1")?.title).toBe("Atopic Dermatitis");
  });

  it("keeps content from untitled sub-sections in their parent", () => {
    const sentences = [...allSentences([find(label.sections, "14.1")!])];
    const endpoint = sentences.find((s) => s.text.includes("IGA 0 (clear) or 1 (almost clear)"));
    expect(endpoint?.section).toBe("14.1");
    expect(endpoint?.id).toMatch(/^14\.1:\d+\.\d+$/);
  });

  it("flattens inline markup into readable text", () => {
    const text = [...allSentences(label.sections)].map((s) => s.text).join("\n");
    expect(text).toContain("SOLO 1 (NCT02277743)");
    expect(text).not.toMatch(/\t| {2}/);
  });

  it("drops table footnotes from cell text", () => {
    const rows = [...allSentences([find(label.sections, "14.1")!])].filter((s) => s.kind === "table-row");
    expect(rows.some((r) => r.text.includes("Responder was defined"))).toBe(false);
  });

  it("turns table rows into cited rows", () => {
    const rows = [...allSentences([find(label.sections, "14.1")!])].filter((s) => s.kind === "table-row");
    expect(rows.length).toBeGreaterThan(5);
    expect(rows.some((r) => r.text.includes(" | "))).toBe(true);
  });

  it("gives every sentence a unique id", () => {
    const ids = [...allSentences(label.sections)].map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("leaves out carton panels and patient instructions", () => {
    const titles = label.sections.map((s) => s.title.toLowerCase());
    expect(titles.some((t) => t.includes("principal display panel"))).toBe(false);
    expect(titles.some((t) => t.includes("instructions for use"))).toBe(false);
    expect(label.sections.every((s) => s.title !== "")).toBe(true);
  });
});
