import { describe, expect, it } from "vitest";
import { skillBody } from "../src/runner.ts";

describe("skillBody", () => {
  it("drops the frontmatter and keeps the instructions", () => {
    expect(skillBody("---\nname: x\ndescription: y\n---\n\n# Title\n\nDo it.\n")).toBe("# Title\n\nDo it.");
    expect(skillBody("# No frontmatter")).toBe("# No frontmatter");
  });
});
