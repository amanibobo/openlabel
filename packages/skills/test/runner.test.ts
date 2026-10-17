import type { Llm } from "@openlabel/llm";
import { describe, expect, it } from "vitest";
import { llmJudge, skillBody } from "../src/runner.ts";

describe("skillBody", () => {
  it("drops the frontmatter and keeps the instructions", () => {
    expect(skillBody("---\nname: x\ndescription: y\n---\n\n# Title\n\nDo it.\n")).toBe("# Title\n\nDo it.");
    expect(skillBody("# No frontmatter")).toBe("# No frontmatter");
  });
});

describe("llmJudge", () => {
  const transcript = { reply: "Ask about DUPIXENT.", toolCalls: [] };

  it("grades the reply against the question and request it was given", async () => {
    const seen: string[] = [];
    const llm: Llm = { name: "test", json: async ({ content }) => (seen.push(content), { pass: true, reason: "" }) as never };
    expect(await llmJudge(llm)("Does it name the drug?", transcript, "Draft a text")).toBe(true);
    expect(seen[0]).toContain("<request>\nDraft a text\n</request>");
    expect(seen[0]).toContain("<reply>\nAsk about DUPIXENT.\n</reply>");
    expect(seen[0]).toContain("Question: Does it name the drug?");
  });

  it("raises a refusal instead of counting it as a failed grade", async () => {
    const llm: Llm = { name: "test", json: async () => { throw new Error("the model declined: cyber"); } };
    await expect(llmJudge(llm)("q", transcript, "p")).rejects.toThrow("the model declined");
  });
});
