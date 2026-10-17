import type { Llm } from "@openlabel/llm";
import { z } from "zod";
import { stateName } from "./trials.ts";
import type { Search } from "./types.ts";

const Parsed = z.object({
  state: z.string().describe("Two-letter US state code"),
  specialty: z.string().describe('Medicare Part D prescriber type, e.g. "Dermatology", "Endocrinology", "Hematology-Oncology"'),
  drugs: z.array(z.string()).describe('Generic names as CMS spells them, e.g. "Dupilumab", "Semaglutide"'),
  maxPayments: z.number().nullable().describe("Most industry payments allowed over 2023 to 2025, in US dollars; null if not limited"),
});

const SYSTEM = `Turn a question about which doctors to reach into a search over Medicare Part D prescribing (2024) and Open Payments (2023 to 2025).
Part D records drugs, not diagnoses, so translate a condition into the drugs that treat it: name the main branded drugs for that condition by generic name.
"No industry contact" means maxPayments 0. "Low contact" or "little industry money" means 100 unless a number is given.`;

export type ParseQuery = (question: string) => Promise<Omit<Search, "limit">>;

export function queryParser(llm: Llm): ParseQuery {
  return async (question) => {
    const parsed = await llm.json({ system: SYSTEM, content: question, schema: Parsed, effort: "low" });
    stateName(parsed.state);
    return { ...parsed, state: parsed.state.toUpperCase() };
  };
}
