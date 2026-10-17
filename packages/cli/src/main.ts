import { existsSync } from "node:fs";
import { run } from "./run.ts";

if (existsSync(".env")) process.loadEnvFile(".env");

process.exitCode = await run(process.argv.slice(2), {
  stdout: (text) => process.stdout.write(`${text}\n`),
  stderr: (text) => process.stderr.write(`${text}\n`),
  color: process.stdout.isTTY === true && !process.env.NO_COLOR,
  interactive: "Bun" in globalThis && process.stdout.isTTY === true && process.stdin.isTTY === true,
  ...(process.stderr.isTTY && {
    status: (text: string | null) => process.stderr.write(text === null ? "\r\x1b[2K" : `\r\x1b[2K\x1b[90m${text}…\x1b[0m`),
  }),
});
