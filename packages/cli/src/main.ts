import { existsSync } from "node:fs";
import { run } from "./run.ts";

if (existsSync(".env")) process.loadEnvFile(".env");

process.exitCode = await run(process.argv.slice(2), {
  stdout: (text) => process.stdout.write(`${text}\n`),
  stderr: (text) => process.stderr.write(`${text}\n`),
  color: process.stdout.isTTY === true && !process.env.NO_COLOR,
});
