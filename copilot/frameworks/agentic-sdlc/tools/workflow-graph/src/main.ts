// Tier B (PDM-class-modeled-R7): the thin entry point. It reads the config, builds the composition root and runs one command.
import { compose, readConfig } from '#src/CompositionRoot.ts';

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString('utf8');
}

async function main(argv: readonly string[]): Promise<number> {
  const handlers = compose(readConfig(process.env, process.cwd()));
  const [command = '', ...args] = argv;
  const handler = handlers.get(command);
  if (handler === undefined) {
    process.stdout.write(`usage: workflow-graph <${[...handlers.keys()].join('|')}> …\n`);
    return 2;
  }
  const { code, out } = await handler(args, readStdin);
  if (out !== '') process.stdout.write(`${out}\n`);
  return code;
}

process.exitCode = await main(process.argv.slice(2));
