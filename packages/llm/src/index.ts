import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";

// The one thing Open Label asks of a model: answer in JSON that matches a schema.
export type Llm = {
  name: string;
  json<T>(request: { system: string; content: string; schema: z.ZodType<T>; effort?: "low" | "medium" | "high" }): Promise<T>;
};

export const DEFAULT_ANTHROPIC_MODEL = "claude-opus-5-5";

export function anthropicLlm(options: { client?: Anthropic; model?: string } = {}): Llm {
  const client = options.client ?? new Anthropic();
  const model = options.model ?? DEFAULT_ANTHROPIC_MODEL;
  return {
    name: `anthropic/${model}`,
    async json({ system, content, schema, effort = "medium" }) {
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
    },
  };
}

type Fetch = (url: string, init: RequestInit) => Promise<Response>;

// Any endpoint that speaks the OpenAI chat completions API: OpenAI, OpenRouter, Gemini, Groq, Ollama.
export function openAiCompatibleLlm(options: { baseURL: string; apiKey?: string; model: string; fetch?: Fetch }): Llm {
  const fetchFn = options.fetch ?? fetch;
  return {
    name: `${new URL(options.baseURL).host}/${options.model}`,
    async json({ system, content, schema }) {
      const { $schema: _ignored, ...jsonSchema } = z.toJSONSchema(schema) as Record<string, unknown>;
      const response = await fetchFn(`${options.baseURL.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(options.apiKey && { authorization: `Bearer ${options.apiKey}` }),
        },
        body: JSON.stringify({
          model: options.model,
          messages: [
            { role: "system", content: system },
            { role: "user", content },
          ],
          response_format: { type: "json_schema", json_schema: { name: "result", strict: true, schema: jsonSchema } },
        }),
      });
      if (!response.ok) throw new Error(`${new URL(options.baseURL).host} returned ${response.status}: ${(await response.text()).slice(0, 300)}`);
      const body = (await response.json()) as { choices?: { message?: { content?: string | null; refusal?: string | null }; finish_reason?: string }[] };
      const choice = body.choices?.[0];
      if (choice?.message?.refusal) throw new Error(`the model declined: ${choice.message.refusal}`);
      if (choice?.finish_reason === "length") throw new Error("the model ran out of output tokens");
      const text = choice?.message?.content;
      if (!text) throw new Error("the model returned no content");
      const parsed = schema.safeParse(JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, "")));
      if (!parsed.success) throw new Error("the model returned output that did not match the schema");
      return parsed.data;
    },
  };
}

export const PROVIDERS = {
  anthropic: { env: "ANTHROPIC_API_KEY" },
  openai: { env: "OPENAI_API_KEY", baseURL: "https://api.openai.com/v1" },
  openrouter: { env: "OPENROUTER_API_KEY", baseURL: "https://openrouter.ai/api/v1" },
  gemini: { env: "GEMINI_API_KEY", baseURL: "https://generativelanguage.googleapis.com/v1beta/openai" },
  groq: { env: "GROQ_API_KEY", baseURL: "https://api.groq.com/openai/v1" },
  ollama: { env: null, baseURL: "http://localhost:11434/v1" },
} as const;

export type Provider = keyof typeof PROVIDERS;

export function isProvider(value: string): value is Provider {
  return value in PROVIDERS;
}

// Picks the provider named, or the first one whose key is set, Anthropic first.
// Every provider but Anthropic needs a model id, because Open Label can't know which
// of a provider's models you want or can use.
export function llmFromEnv(options: { provider?: string; model?: string; env?: Record<string, string | undefined> } = {}): Llm {
  const env = options.env ?? process.env;
  const named = options.provider ?? env.OPENLABEL_PROVIDER;
  if (named !== undefined && !isProvider(named)) {
    throw new Error(`unknown provider "${named}"; use one of ${Object.keys(PROVIDERS).join(", ")}`);
  }
  const provider: Provider =
    named ?? (Object.keys(PROVIDERS) as Provider[]).find((p) => PROVIDERS[p].env && env[PROVIDERS[p].env!]) ?? "anthropic";
  const model = options.model ?? env.OPENLABEL_MODEL;

  if (provider === "anthropic") return anthropicLlm(model ? { model } : {});
  const config = PROVIDERS[provider];
  if (!model) throw new Error(`set a model for ${provider} with --model or OPENLABEL_MODEL`);
  const apiKey = config.env ? env[config.env] : undefined;
  if (config.env && !apiKey) throw new Error(`${provider} needs ${config.env}`);
  return openAiCompatibleLlm({ baseURL: env.OPENLABEL_BASE_URL ?? config.baseURL, model, ...(apiKey && { apiKey }) });
}
