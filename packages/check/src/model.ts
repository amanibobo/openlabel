import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { Sentence } from "@openlabel/label";
import { z } from "zod";
import { CLAIM_KINDS, VERDICTS, type ClaimKind, type Verdict } from "./types.ts";

export type ExtractedClaim = { text: string; kind: ClaimKind };

export type JudgeInput = { labelTitle: string; claim: string; kind: ClaimKind; candidates: readonly Sentence[] };

export type RawJudgment = { verdict: Verdict; evidence: string[]; reason: string };

export type ClaimModel = {
  extract(piece: string, labelTitle: string): Promise<ExtractedClaim[]>;
  judge(input: JudgeInput): Promise<RawJudgment>;
};

const Extraction = z.object({
  claims: z.array(z.object({ text: z.string(), kind: z.enum(CLAIM_KINDS) })),
});

const JudgmentSchema = z.object({
  verdict: z.enum(VERDICTS),
  evidence: z.array(z.string()),
  reason: z.string(),
});

const EXTRACT_SYSTEM = `You review pharmaceutical promotional material for a medical, legal and regulatory (MLR) team.
List every claim a reader could take as a statement about the drug: efficacy, safety, dosing, indication, quality of life, or a comparison.
Quote each claim exactly as it appears in the piece, as the shortest span that still carries the whole claim.
Leave out branding, calls to action, and contact details.`;

const JUDGE_SYSTEM = `You judge one promotional claim against excerpts from the drug's FDA prescribing information.
Verdicts:
- supported: the excerpts state it, and the claim is no stronger than the label.
- overstated: the label supports only a weaker version, such as a smaller effect, a narrower population, or a scale score presented as a life outcome.
- off-label: the claim describes a use, population, or dose the label does not include.
- unsupported: nothing in the excerpts addresses it.
Cite the ids of the sentences your verdict rests on; leave the list empty only for unsupported.
Give the reason as one plain sentence a reviewer can check against the cited text.`;

export const DEFAULT_MODEL = "claude-opus-5-5";

export function claudeModel(options: { client?: Anthropic; model?: string } = {}): ClaimModel {
  const client = options.client ?? new Anthropic();
  const model = options.model ?? DEFAULT_MODEL;

  async function ask<T>(
    system: string,
    content: string,
    schema: z.ZodType<T>,
    effort: "medium" | "high",
  ): Promise<T> {
    const response = await client.beta.messages.parse({
      model,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system,
      messages: [{ role: "user", content }],
      output_config: { effort, format: betaZodOutputFormat(schema) },
    });
    if (response.stop_reason === "refusal") throw new Error(`the model declined: ${response.stop_details?.category ?? "no category"}`);
    if (response.stop_reason === "max_tokens") throw new Error("the model ran out of output tokens");
    if (!response.parsed_output) throw new Error("the model returned output that did not match the schema");
    return response.parsed_output;
  }

  return {
    async extract(piece, labelTitle) {
      const content = `Drug: ${labelTitle}\n\n<piece>\n${piece}\n</piece>`;
      const result = await ask(EXTRACT_SYSTEM, content, Extraction, "medium");
      return result.claims;
    },
    async judge({ labelTitle, claim, kind, candidates }) {
      const excerpts = candidates.map((s) => `[${s.id}] ${s.text}`).join("\n");
      const content = `Drug: ${labelTitle}\nClaim (${kind}): ${claim}\n\n<excerpts>\n${excerpts}\n</excerpts>`;
      return ask(JUDGE_SYSTEM, content, JudgmentSchema, "high");
    },
  };
}
