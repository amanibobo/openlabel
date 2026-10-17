#!/usr/bin/env node
// Bun runs the TypeScript directly (and can show the OpenTUI screen); Node needs tsx.
if (!("Bun" in globalThis)) {
  const { register } = await import("tsx/esm/api");
  register();
}
await import("../src/main.ts");
