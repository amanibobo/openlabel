import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat, betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { claimModel } from "@openlabel/check";
import { dailyMed } from "@openlabel/label";
import { anthropicLlm } from "@openlabel/llm";
import type { Judge, Transcript } from "./cases.ts";
import { evaluateSkill, type SkillResult } from "./evaluate.ts";
import { openLabelTools, type OpenLabelTools } from "./tools.ts";

const HARNESS = `You are running inside an evaluation harness. You cannot run shell commands or write files.
The openlabel commands the skill mentions are available as tools instead: openlabel_check takes the piece's text directly instead of a file, openlabel_search and openlabel_diff take the same arguments as the commands.
The rule pack named examples/pulse-sms.yaml is available to openlabel_check as "pulse-sms".
When the skill says to save a variant to a file and check it, call openlabel_check with the variant's text.
Reply to the user exactly as the skill describes.`;

export function skillBody(markdown: string): string {
  return markdown.replace(/^---\n[\s\S]*?\n---\n/, "").trim();
}

export async function runSkill(options: {
  client: Anthropic;
  model: string;
  skill: string;
  prompt: string;
  tools: OpenLabelTools;
}): Promise<Transcript> {
  const toolCalls: string[] = [];
  const guarded = <A>(name: string, fn: (args: A) => Promise<string>) => async (args: A) => {
    toolCalls.push(name);
    try {
      return await fn(args);
    } catch (error) {
      return `Error: ${(error as Error).message}`;
    }
  };

  const tools = [
    betaZodTool({
      name: "openlabel_check",
      description: "Check a piece of promotional text against a drug's FDA label. Returns each claim's verdict, reason and cited label sentences, plus rule findings.",
      inputSchema: z.object({
        piece: z.string().describe("The full text of the piece"),
        drug: z.string().describe("Brand name, such as dupixent"),
        rules: z.string().optional().describe('Rule pack name, such as "pulse-sms"'),
      }),
      run: guarded("openlabel_check", options.tools.check),
    }),
    betaZodTool({
      name: "openlabel_search",
      description: "Find the label sentences that best match a question, with citations.",
      inputSchema: z.object({ drug: z.string(), question: z.string(), limit: z.number().int().optional() }),
      run: guarded("openlabel_search", options.tools.search),
    }),
    betaZodTool({
      name: "openlabel_diff",
      description: "List every sentence that changed between two versions of a drug's label. Defaults to the current version and the one before it.",
      inputSchema: z.object({ drug: z.string(), from: z.number().int().optional(), to: z.number().int().optional() }),
      run: guarded("openlabel_diff", options.tools.diff),
    }),
  ];

  const message = await options.client.beta.messages.toolRunner({
    model: options.model,
    max_tokens: 16000,
    max_iterations: 16,
    system: `${HARNESS}\n\n${skillBody(options.skill)}`,
    tools,
    messages: [{ role: "user", content: options.prompt }],
  });
  if (message.stop_reason === "refusal") throw new Error("the model declined the task");

  const reply = message.content
    .flatMap((block) => (block.type === "text" ? [block.text] : []))
    .join("\n")
    .trim();
  return { reply, toolCalls };
}

const Verdict = z.object({ pass: z.boolean(), reason: z.string() });

export function claudeJudge(client: Anthropic, model: string): Judge {
  return async (question, transcript, prompt) => {
    const response = await client.beta.messages.parse({
      model,
      max_tokens: 4000,
      system: "You grade one reply against one yes/no question. Answer pass only if the reply clearly satisfies it.",
      messages: [
        {
          role: "user",
          content: `<request>\n${prompt}\n</request>\n\n<reply>\n${transcript.reply}\n</reply>\n\nQuestion: ${question}`,
        },
      ],
      output_config: { effort: "medium", format: betaZodOutputFormat(Verdict) },
    });
    return response.parsed_output?.pass === true;
  };
}

export function claudeEvaluator(options: {
  skillsDir: string;
  model: string;
  packs: Record<string, string>;
}): (skill: string, only: string | undefined) => Promise<SkillResult> {
  const client = new Anthropic();
  const tools = openLabelTools({
    dailyMed: dailyMed(),
    model: claimModel(anthropicLlm({ client, model: options.model })),
    packs: options.packs,
  });
  const judge = claudeJudge(client, options.model);
  return (skill, only) =>
    evaluateSkill(options.skillsDir, skill, {
      judge,
      ...(only && { only }),
      run: (skillText, prompt) => runSkill({ client, model: options.model, skill: skillText, prompt, tools }),
    });
}
