import { allSentences, type Label, type Section, type Sentence } from "@openlabel/label";

export type Category =
  | "boxed-warning"
  | "indication"
  | "dosing"
  | "contraindication"
  | "warning"
  | "adverse-reactions"
  | "clinical-studies"
  | "other";

export type SentenceChange =
  | { kind: "added"; after: Sentence }
  | { kind: "removed"; before: Sentence }
  | { kind: "changed"; before: Sentence; after: Sentence };

export type SectionChange = {
  section: string;
  title: string;
  category: Category;
  status: "added" | "removed" | "changed";
  changes: SentenceChange[];
};

export type LabelDiff = {
  setId: Label["setId"];
  title: string;
  from: { version: number; effectiveDate: string };
  to: { version: number; effectiveDate: string };
  sections: SectionChange[];
};

export function categoryOf(section: string): Category {
  if (section === "boxed") return "boxed-warning";
  const top = section.split(".")[0];
  switch (top) {
    case "1":
      return "indication";
    case "2":
    case "3":
      return "dosing";
    case "4":
      return "contraindication";
    case "5":
      return "warning";
    case "6":
      return "adverse-reactions";
    case "14":
      return "clinical-studies";
    default:
      return "other";
  }
}

// Inserting one table renumbers every table after it; that is not a change in meaning.
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/\b(table|figure)\s+\d+/g, "$1 #")
    .replace(/\s+/g, " ")
    .trim();
}

function words(text: string): Set<string> {
  return new Set(normalize(text).match(/[a-z0-9.%]+/g) ?? []);
}

function similarity(a: string, b: string): number {
  const wa = words(a);
  const wb = words(b);
  const shared = [...wa].filter((w) => wb.has(w)).length;
  return shared / Math.max(wa.size, wb.size, 1);
}

function diffSentences(before: Sentence[], after: Sentence[]): SentenceChange[] {
  const a = before.map((s) => normalize(s.text));
  const b = after.map((s) => normalize(s.text));
  const lcs: number[][] = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lcs[i]![j] = a[i] === b[j] ? lcs[i + 1]![j + 1]! + 1 : Math.max(lcs[i + 1]![j]!, lcs[i]![j + 1]!);
    }
  }

  const changes: SentenceChange[] = [];
  let removed: Sentence[] = [];
  let added: Sentence[] = [];
  const flush = () => {
    // Pair a removal with the addition that replaced it when they mostly share words.
    while (removed.length && added.length) {
      const r = removed[0]!;
      const match = added.findIndex((s) => similarity(r.text, s.text) >= 0.5);
      if (match < 0) break;
      changes.push({ kind: "changed", before: r, after: added[match]! });
      removed.shift();
      added.splice(match, 1);
    }
    changes.push(...removed.map((s) => ({ kind: "removed" as const, before: s })));
    changes.push(...added.map((s) => ({ kind: "added" as const, after: s })));
    removed = [];
    added = [];
  };

  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      flush();
      i++;
      j++;
    } else if (j < b.length && (i === a.length || lcs[i]![j + 1]! >= lcs[i + 1]![j]!)) {
      added.push(after[j++]!);
    } else {
      removed.push(before[i++]!);
    }
  }
  flush();
  return changes;
}

function bySection(label: Label): Map<string, Sentence[]> {
  const map = new Map<string, Sentence[]>();
  for (const s of allSentences(label.sections)) map.set(s.section, [...(map.get(s.section) ?? []), s]);
  return map;
}

function titles(sections: readonly Section[], into = new Map<string, string>()): Map<string, string> {
  for (const section of sections) {
    const key = section.sentences[0]?.section ?? section.number;
    if (key) into.set(key, section.title);
    titles(section.subsections, into);
  }
  return into;
}

export function diffLabels(before: Label, after: Label): LabelDiff {
  const old = bySection(before);
  const next = bySection(after);
  const names = new Map([...titles(before.sections), ...titles(after.sections)]);
  const keys = [...new Set([...old.keys(), ...next.keys()])];

  const sections: SectionChange[] = [];
  for (const key of keys) {
    const changes = diffSentences(old.get(key) ?? [], next.get(key) ?? []);
    if (!changes.length) continue;
    sections.push({
      section: key,
      title: names.get(key) ?? key,
      category: categoryOf(key),
      status: !old.has(key) ? "added" : !next.has(key) ? "removed" : "changed",
      changes,
    });
  }

  return {
    setId: after.setId,
    title: after.title,
    from: { version: before.version, effectiveDate: before.effectiveDate },
    to: { version: after.version, effectiveDate: after.effectiveDate },
    sections,
  };
}
