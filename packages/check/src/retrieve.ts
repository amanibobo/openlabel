import { allSentences, type Label, type Sentence } from "@openlabel/label";
import type { ClaimKind } from "./types.ts";

const STOPWORDS = new Set(
  "a an and are as at be by for from has have in is it its of on or that the this to was were with your you".split(" "),
);

export function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9]+%?/g) ?? []).filter((t) => !STOPWORDS.has(t));
}

const PREFERRED_SECTIONS: Record<ClaimKind, readonly string[]> = {
  efficacy: ["14"],
  "quality-of-life": ["14"],
  comparative: ["14"],
  dosing: ["2", "3"],
  indication: ["1"],
  safety: ["boxed", "4", "5", "6"],
  other: [],
};

function inPreferred(sentence: Sentence, kind: ClaimKind): boolean {
  return PREFERRED_SECTIONS[kind].some((s) => sentence.section === s || sentence.section.startsWith(`${s}.`));
}

export type Retriever = (query: string, kind: ClaimKind, k?: number) => Sentence[];

export function retriever(label: Label): Retriever {
  const sentences = [...allSentences(label.sections)];
  const docs = sentences.map((s) => tokenize(s.context ? `${s.context} ${s.text}` : s.text));
  const avgLength = docs.reduce((sum, d) => sum + d.length, 0) / Math.max(docs.length, 1);
  const documentFrequency = new Map<string, number>();
  for (const doc of docs) for (const term of new Set(doc)) documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1);

  const idf = (term: string) => {
    const n = documentFrequency.get(term) ?? 0;
    return Math.log(1 + (sentences.length - n + 0.5) / (n + 0.5));
  };

  return (query, kind, k = 8) => {
    const terms = [...new Set(tokenize(query))];
    const scored = sentences.map((sentence, i) => {
      const doc = docs[i] ?? [];
      let score = 0;
      for (const term of terms) {
        const tf = doc.filter((t) => t === term).length;
        if (!tf) continue;
        score += (idf(term) * tf * 2.2) / (tf + 1.2 * (0.25 + (0.75 * doc.length) / avgLength));
      }
      return { sentence, score: inPreferred(sentence, kind) ? score * 1.5 : score };
    });
    const top = scored
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, k)
      .map((s) => s.sentence);

    if (kind !== "indication") return top;
    const indications = sentences.filter((s) => inPreferred(s, "indication"));
    return [...new Map([...indications, ...top].map((s) => [s.id, s])).values()];
  };
}
