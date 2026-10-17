import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
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

export function claudeQueryParser(options: { client?: Anthropic; model?: string } = {}): ParseQuery {
  const client = options.client ?? new Anthropic();
  return async (question) => {
    const response = await client.beta.messages.parse({
      model: options.model ?? "claude-opus-5-5",
      max_tokens: 4000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: SYSTEM,
      messages: [{ role: "user", content: question }],
      output_config: { effort: "low", format: betaZodOutputFormat(Parsed) },
    });
    if (response.stop_reason === "refusal") throw new Error("the model declined to parse the question");
    const parsed = response.parsed_output;
    if (!parsed) throw new Error("the model returned a search that did not match the schema");
    stateName(parsed.state);
    return { ...parsed, state: parsed.state.toUpperCase() };
  };
}
