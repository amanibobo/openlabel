export type SetId = string & { readonly __brand: "SetId" };

// "14.1:3.2" is section 14.1, paragraph 3, sentence 2.
export type SentenceId = string & { readonly __brand: "SentenceId" };

export type SentenceKind = "prose" | "list-item" | "table-row";

export type Sentence = {
  id: SentenceId;
  section: string;
  paragraph: number;
  kind: SentenceKind;
  text: string;
};

export type Section = {
  // Null for unnumbered sections such as the boxed warning or patient information.
  number: string | null;
  title: string;
  loinc: string;
  sentences: Sentence[];
  subsections: Section[];
};

export type Label = {
  setId: SetId;
  version: number;
  title: string;
  effectiveDate: string;
  sections: Section[];
};

export function asSetId(value: string): SetId {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
    throw new Error(`not a DailyMed set id: ${value}`);
  }
  return value.toLowerCase() as SetId;
}

export function* allSentences(sections: readonly Section[]): Generator<Sentence> {
  for (const section of sections) {
    yield* section.sentences;
    yield* allSentences(section.subsections);
  }
}

export function cite(sentence: Sentence): string {
  return `§${sentence.section} ¶${sentence.paragraph}`;
}
