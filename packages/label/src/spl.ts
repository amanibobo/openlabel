import { XMLParser } from "fast-xml-parser";
import { splitSentences } from "./sentences.ts";
import { asSetId, type Label, type Section, type SentenceId, type SentenceKind } from "./types.ts";

type Node = { [tag: string]: Node[] | string | Record<string, string> | undefined; ":@"?: Record<string, string> };

// Package carton panels, patient medication guides and instructions for use are not
// part of the prescribing information claims are judged against.
const EXCLUDED_LOINC = new Set(["51945-4", "59845-8", "42230-3", "42231-1", "48780-1"]);

const UNNUMBERED: Record<string, { key: string; title: string }> = {
  "34066-1": { key: "boxed", title: "Boxed warning" },
  "43683-2": { key: "recent-changes", title: "Recent major changes" },
};

const parser = new XMLParser({
  preserveOrder: true,
  ignoreAttributes: false,
  attributeNamePrefix: "",
  trimValues: false,
  processEntities: true,
});

function tagOf(node: Node): string {
  return Object.keys(node).find((key) => key !== ":@") ?? "";
}

function childrenOf(node: Node): Node[] {
  const value = node[tagOf(node)];
  return Array.isArray(value) ? value : [];
}

function attr(node: Node, name: string): string | undefined {
  return node[":@"]?.[name];
}

function child(node: Node, tag: string): Node | undefined {
  return childrenOf(node).find((c) => tagOf(c) === tag);
}

function descendant(node: Node, path: readonly string[]): Node | undefined {
  const [first, ...rest] = path;
  if (!first) return node;
  for (const c of childrenOf(node)) {
    const found = tagOf(c) === first ? descendant(c, rest) : descendant(c, path);
    if (found) return found;
  }
  return undefined;
}

function textOf(node: Node): string {
  const tag = tagOf(node);
  if (tag === "#text") return String(node["#text"] ?? "");
  if (tag === "footnote" || tag === "footnoteRef" || tag === "renderMultiMedia") return "";
  if (tag === "br") return " ";
  return childrenOf(node).map(textOf).join("");
}

function clean(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

type Block = { kind: SentenceKind; text: string; context?: string };

function blocksOf(text: Node): Block[] {
  const blocks: Block[] = [];
  for (const node of childrenOf(text)) {
    const tag = tagOf(node);
    if (tag === "paragraph") {
      blocks.push({ kind: "prose", text: textOf(node) });
    } else if (tag === "list") {
      for (const item of childrenOf(node).filter((c) => tagOf(c) === "item")) {
        blocks.push({ kind: "list-item", text: textOf(item) });
      }
    } else if (tag === "table") {
      blocks.push(...tableRows(node));
    }
  }
  return blocks.filter((b) => clean(b.text) !== "");
}

function tableRows(table: Node): Block[] {
  const rows: Block[] = [];
  const captionNode = child(table, "caption");
  const caption = captionNode ? clean(textOf(captionNode)) : "";
  if (caption) rows.push({ kind: "prose", text: caption });
  for (const group of childrenOf(table)) {
    for (const row of childrenOf(group).filter((c) => tagOf(c) === "tr")) {
      const cells = childrenOf(row)
        .filter((c) => tagOf(c) === "td" || tagOf(c) === "th")
        .map((c) => clean(textOf(c)))
        .filter(Boolean);
      if (cells.length) rows.push({ kind: "table-row", text: cells.join(" | "), ...(caption && { context: caption }) });
    }
  }
  return rows;
}

function parseTitle(raw: string): { number: string | null; title: string } {
  const title = clean(raw);
  const match = /^(\d+(?:\.\d+)*)\s+(.*)$/.exec(title);
  return match?.[1] && match[2] ? { number: match[1], title: match[2] } : { number: null, title };
}

function sectionKey(number: string | null, loinc: string, title: string): string {
  return number ?? UNNUMBERED[loinc]?.key ?? title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function buildSection(node: Node, parentKey?: string, counter?: { paragraph: number }): Section | Block[] | null {
  const loinc = attr(child(node, "code") ?? {}, "code") ?? "";
  if (EXCLUDED_LOINC.has(loinc)) return null;
  const titleNode = child(node, "title");
  const rawTitle = titleNode ? clean(textOf(titleNode)) : "";
  const textNode = child(node, "text");
  const blocks = textNode ? blocksOf(textNode) : [];
  const nested = childrenOf(node)
    .filter((c) => tagOf(c) === "component")
    .map((c) => child(c, "section"))
    .filter((s): s is Node => s !== undefined);

  // An untitled section is a continuation of its parent: hand its blocks upward.
  if (!rawTitle && parentKey === undefined && !UNNUMBERED[loinc]) return null;
  if (!rawTitle && parentKey !== undefined) {
    return [...blocks, ...nested.flatMap((n) => {
      const result = buildSection(n, parentKey, counter);
      return Array.isArray(result) ? result : [];
    })];
  }

  const { number, title } = parseTitle(rawTitle || (UNNUMBERED[loinc]?.title ?? ""));
  const key = sectionKey(number, loinc, title);
  const section: Section = { number, title, loinc, sentences: [], subsections: [] };
  const own = { paragraph: 0 };

  const addBlocks = (list: Block[]) => {
    for (const block of list) {
      own.paragraph += 1;
      splitSentences(block.text).forEach((text, i) => {
        section.sentences.push({
          id: `${key}:${own.paragraph}.${i + 1}` as SentenceId,
          section: key,
          paragraph: own.paragraph,
          kind: block.kind,
          text,
          ...(block.context && { context: block.context }),
        });
      });
    }
  };

  addBlocks(blocks);
  for (const n of nested) {
    const result = buildSection(n, key, own);
    if (Array.isArray(result)) addBlocks(result);
    else if (result) section.subsections.push(result);
  }
  return section;
}

function isoDate(value: string | undefined): string {
  const match = /^(\d{4})(\d{2})(\d{2})/.exec(value ?? "");
  return match ? `${match[1]}-${match[2]}-${match[3]}` : "";
}

export function parseSpl(xml: string): Label {
  const root = (parser.parse(xml) as Node[]).find((n) => tagOf(n) === "document");
  if (!root) throw new Error("not an SPL document");

  const setId = attr(child(root, "setId") ?? {}, "root");
  const version = Number(attr(child(root, "versionNumber") ?? {}, "value"));
  if (!setId || !Number.isFinite(version)) throw new Error("SPL document has no set id or version");

  const body = child(child(root, "component") ?? {}, "structuredBody");
  const sections = childrenOf(body ?? {})
    .filter((c) => tagOf(c) === "component")
    .map((c) => child(c, "section"))
    .filter((s): s is Node => s !== undefined)
    .map((s) => buildSection(s))
    .filter((s): s is Section => s !== null && !Array.isArray(s));

  const product = descendant(root, ["manufacturedProduct", "manufacturedProduct", "name"]);
  const generic = descendant(root, ["genericMedicine", "name"]);
  const brand = clean(textOf(product ?? {}));
  const title = generic ? `${brand} (${clean(textOf(generic)).toLowerCase()})` : brand;

  return {
    setId: asSetId(setId),
    version,
    title,
    effectiveDate: isoDate(attr(child(root, "effectiveTime") ?? {}, "value")),
    sections,
  };
}
