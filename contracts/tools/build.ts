// The entry point of the build tool (specs/022 T077, build-v1.md): `node contracts/tools/build.ts <subcommand> [options]`.
// It only chooses the subcommand and turns its outcome into output and an exit code; each subcommand is a function in its own file.
// Exit codes (A-8): 0 ok, 1 a check failed, 2 a wrong command line. The tool imports nothing outside contracts/ (DR-302).
import { runBudget } from './budget.ts';
import { runCheckSchemas } from './check-schemas.ts';
import { runLayout } from './layout.ts';
import { ExitCode, failure, oneLine, realEnv, type Outcome, type ToolEnv } from './tool-io.ts';

/** The help text: what this version does, and what it does not do yet (build-v1.md lists the full tool). */
export const HELP = `build.ts: the build tool of agent-config (contracts/build/v1)

Usage: node contracts/tools/build.ts <subcommand> [options]

Subcommands built in this version:
  budget --baseline [--root <dir>] [--agent-home <path>] [--platform darwin|win32|linux]
                    [--allow-list <file>] [--out <file>] [--render <file>]
      The dry run of the always-loaded size. It renders in memory the files each agent loads at session start
      (Claude Code, Copilot CLI, Codex) and prints one JSON report (schema: build/v1) on standard output.
      It writes nothing, unless --out is given: then the same report goes to <file>, relative to --root.
      --render <file> prints that one file as rendered. The default --agent-home is ~/.agent-config.
      The only git command it runs is "git rev-parse HEAD".
  layout [--report] [--repo <name>] [--root <dir>]
      Checks the repository root against contracts/repo-layout/v1/rules.yaml. With --report findings are
      listed and the exit code is 0; without it any finding exits 1. --repo names the repository for its exceptions.
  check-schemas <file>...
      Reads each file with the contract reader: "<file>: error|warning: <field>: <message>" or "<file>: ok".
      A file named index.md is checked as the contracts index.

Not built yet (later phases): build (skill and agent sources), budget without --baseline, cite.

Options: -h, --help   show this text
Exit codes: 0 ok, 1 a check failed, 2 usage error`;

const SUBCOMMANDS: Readonly<Record<string, (argv: readonly string[], env: ToolEnv) => Outcome>> = {
  budget: runBudget,
  layout: runLayout,
  'check-schemas': runCheckSchemas,
};

/**
 * Runs the build tool for the arguments after the script name.
 *
 * @param argv - the subcommand and its options
 * @param env - the machine and the moment, so a test can fix them
 * @returns the exit code and the text for each stream
 */
export function runBuild(argv: readonly string[], env: ToolEnv): Outcome {
  const [subcommand, ...rest] = argv;
  if (subcommand === '-h' || subcommand === '--help' || subcommand === 'help') {
    return { code: ExitCode.Ok, out: `${HELP}\n`, err: '' };
  }
  if (subcommand === undefined) return failure(ExitCode.Usage, `build.ts: a subcommand is required\n\n${HELP}`);
  const run = Object.hasOwn(SUBCOMMANDS, subcommand) ? SUBCOMMANDS[subcommand] : undefined;
  if (run === undefined) {
    return failure(
      ExitCode.Usage,
      `build.ts: "${oneLine(subcommand.slice(0, 40))}" is not a subcommand built in this version; run build.ts --help`,
    );
  }
  return run(rest, env);
}

if (import.meta.main) {
  const outcome = runBuild(process.argv.slice(2), realEnv());
  process.stdout.write(outcome.out);
  process.stderr.write(outcome.err);
  process.exitCode = outcome.code;
}
