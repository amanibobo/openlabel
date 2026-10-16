const ABBREVIATIONS = new Set([
  "e.g",
  "i.e",
  "vs",
  "approx",
  "dr",
  "fig",
  "no",
  "u.s",
  "al",
  "mr",
  "ms",
  "inc",
  "ltd",
  "co",
]);

function endsWithAbbreviation(text: string): boolean {
  const match = /([A-Za-z][A-Za-z.]*)\.$/.exec(text);
  if (!match?.[1]) return false;
  const word = match[1].toLowerCase();
  return ABBREVIATIONS.has(word) || /^[a-z]$/.test(word);
}

export function splitSentences(text: string): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];

  const sentences: string[] = [];
  let start = 0;
  // A boundary is terminal punctuation (optionally closed by a bracket or quote),
  // then a space, then something that can begin a sentence.
  const boundary = /[.!?]["')\]]*(?= ["'(\[]?[A-Z0-9])/g;
  for (let match = boundary.exec(clean); match; match = boundary.exec(clean)) {
    const end = match.index + match[0].length;
    const candidate = clean.slice(start, end);
    if (endsWithAbbreviation(candidate)) continue;
    sentences.push(candidate.trim());
    start = end + 1;
  }
  const rest = clean.slice(start).trim();
  if (rest) sentences.push(rest);
  return sentences;
}
