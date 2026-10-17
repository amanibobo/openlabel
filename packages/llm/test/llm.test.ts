import { describe, expect, it } from "vitest";
import { z } from "zod";
import { llmFromEnv, openAiCompatibleLlm } from "../src/index.ts";

const Verdict = z.object({ verdict: z.enum(["supported", "overstated"]), reason: z.string() });

function server(reply: unknown, status = 200) {
  const requests: { url: string; headers: Record<string, string>; body: any }[] = [];
  const fetch = async (url: string, init: RequestInit) => {
    requests.push({ url, headers: init.headers as Record<string, string>, body: JSON.parse(String(init.body)) });
    return new Response(JSON.stringify(reply), { status });
  };
  return { fetch, requests };
}

const ok = (content: string) => ({ choices: [{ message: { content }, finish_reason: "stop" }] });

describe("openAiCompatibleLlm", () => {
  it("asks for strict JSON matching the schema and parses the answer", async () => {
    const { fetch, requests } = server(ok('{"verdict":"overstated","reason":"Only 38%."}'));
    const llm = openAiCompatibleLlm({ baseURL: "https://openrouter.ai/api/v1/", apiKey: "k", model: "some/model", fetch });
    expect(await llm.json({ system: "s", content: "c", schema: Verdict })).toEqual({ verdict: "overstated", reason: "Only 38%." });

    const [request] = requests;
    expect(request?.url).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(request?.headers.authorization).toBe("Bearer k");
    expect(request?.body.messages.map((m: { role: string }) => m.role)).toEqual(["system", "user"]);
    expect(request?.body.response_format.json_schema).toMatchObject({ strict: true, schema: { type: "object", required: ["verdict", "reason"] } });
    expect(request?.body.response_format.json_schema.schema.$schema).toBeUndefined();
  });

  it("accepts JSON wrapped in a code fence", async () => {
    const { fetch } = server(ok('```json\n{"verdict":"supported","reason":"r"}\n```'));
    const llm = openAiCompatibleLlm({ baseURL: "http://localhost:11434/v1", model: "m", fetch });
    expect((await llm.json({ system: "s", content: "c", schema: Verdict })).verdict).toBe("supported");
  });

  it("rejects output that breaks the schema, refusals and HTTP errors", async () => {
    const bad = openAiCompatibleLlm({ baseURL: "http://x.test/v1", model: "m", fetch: server(ok('{"verdict":"maybe","reason":"r"}')).fetch });
    await expect(bad.json({ system: "s", content: "c", schema: Verdict })).rejects.toThrow(/did not match the schema/);
    const refused = openAiCompatibleLlm({ baseURL: "http://x.test/v1", model: "m", fetch: server({ choices: [{ message: { content: null, refusal: "no" } }] }).fetch });
    await expect(refused.json({ system: "s", content: "c", schema: Verdict })).rejects.toThrow(/declined: no/);
    const down = openAiCompatibleLlm({ baseURL: "http://x.test/v1", model: "m", fetch: server({ error: "bad key" }, 401).fetch });
    await expect(down.json({ system: "s", content: "c", schema: Verdict })).rejects.toThrow(/x.test returned 401/);
  });
});

describe("llmFromEnv", () => {
  it("defaults to Anthropic, and picks another provider from whichever key is set", () => {
    expect(llmFromEnv({ env: { ANTHROPIC_API_KEY: "a" } }).name).toBe("anthropic/claude-opus-5-5");
    expect(llmFromEnv({ env: { OPENROUTER_API_KEY: "k", OPENLABEL_MODEL: "some/model" } }).name).toBe("openrouter.ai/some/model");
    expect(llmFromEnv({ env: { ANTHROPIC_API_KEY: "a", GEMINI_API_KEY: "g" }, provider: "gemini", model: "m" }).name).toBe("generativelanguage.googleapis.com/m");
  });

  it("explains what is missing", () => {
    expect(() => llmFromEnv({ env: { OPENAI_API_KEY: "k" } })).toThrow("set a model for openai with --model or OPENLABEL_MODEL");
    expect(() => llmFromEnv({ env: {}, provider: "groq", model: "m" })).toThrow("groq needs GROQ_API_KEY");
    expect(() => llmFromEnv({ env: {}, provider: "mistral" })).toThrow(/unknown provider "mistral"/);
  });

  it("runs Ollama without a key and lets the base URL be overridden", () => {
    expect(llmFromEnv({ env: {}, provider: "ollama", model: "llama4" }).name).toBe("localhost:11434/llama4");
    expect(llmFromEnv({ env: { OPENLABEL_BASE_URL: "https://llm.internal/v1" }, provider: "ollama", model: "m" }).name).toBe("llm.internal/m");
  });
});
