// Tier B (PDM-class-modeled-R7): the thin entry point. It reads the config, builds the composition root and runs one command.
import { readFileSync } from "node:fs";
import { compose, readConfig } from "#src/CompositionRoot.ts";

const HELP = new Set(["--help", "-h"]);

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

// `--help`/`-h` anywhere, or no command at all, becomes `help <command words>` (spec 021 FR-006).
function route(argv: readonly string[]): [string, string[]] {
  const [command = "", ...args] = argv;
  if (command === "" || HELP.has(command)) return ["help", []];
  if (args.some((a) => HELP.has(a)))
    return ["help", [command, ...args.filter((a) => !a.startsWith("-"))]];
  return [command, args];
}

function version(): string {
  const pkg = new URL("../package.json", import.meta.url);
  return (JSON.parse(readFileSync(pkg, "utf8")) as { version: string }).version;
}

async function main(argv: readonly string[]): Promise<number> {
  if (argv[0] === "--version") {
    process.stdout.write(`workflow-graph ${version()}\n`);
    return 0;
  }
  const handlers = compose(readConfig(process.env, process.cwd()));
  const [command, args] = route(argv);
  const handler = handlers.get(command);
  if (handler === undefined) {
    process.stderr.write(`unknown command "${command}"; run: workflow-graph help\n`);
    return 2;
  }
  try {
    const { code, out } = await handler(args, readStdin);
    // Usage errors go to stderr; stdout carries only results (clig.dev).
    if (out !== "") (code === 2 ? process.stderr : process.stdout).write(`${out}\n`);
    return code;
  } catch (e) {
    const code = (e as { code?: unknown }).code;
    if (typeof code === "string" && code.startsWith("ERR_PARSE_ARGS")) {
      process.stderr.write(
        `${(e as Error).message.split(". ")[0]}; run: workflow-graph help ${command}\n`,
      );
      return 2;
    }
    throw e;
  }
}

process.exitCode = await main(process.argv.slice(2));
