// installer-test-settings.ts — the test settings of the installer scenarios, read by the test entry only (specs/022 T117).
// Pure code with no Cucumber import, so the test entry (tests/support/installer-test-main.ts, written with the
// CompositionRoot task) and the stand-in tool of tests/installer-world can import it in a child process.
//
// The world (installer-world.ts) writes these environment variables for the process it starts; the test entry reads them with
// readTestSettings and builds the clock, terminal, runtime and fault adapters from the result. The production entry reads
// none of them (the guard is described in fault-adapters.ts).
//
//   AGENT_CONFIG_TEST_NOW                   the fixed instant the Clock port reports (ISO 8601); default 2026-11-20T09:14:03.000Z
//   AGENT_CONFIG_TEST_TERMINAL              `absent` (default; no terminal is attached, so consent needs exit 10, M-11) or a
//                                           JSON array of strings: an interactive terminal that gives those answers in order
//   AGENT_CONFIG_TEST_NODE_VERSION_COMMAND  path of a .mjs script that prints a node version for `--version` (TR-7); the
//                                           Runtime adapter runs it with the current node instead of reading process.version
//   AGENT_CONFIG_TEST_GIT_VERSION_COMMAND   the same for git: a .mjs script that prints what `git --version` would print
//   AGENT_CONFIG_TEST_FAULT                 the faults (grammar in fault-adapters.ts)
//   AGENT_CONFIG_TEST_REPO                  the folder the installer treats as the agent-config checkout (its core
//                                           component.yaml, the public components.yaml and contracts/slots.yaml); each
//                                           installer feature's tool.ts sets it, usually to {root}/repo
// Empty means unset for all of them. The world also sets AGENT_CONFIG_HOME (empty unless a scenario sets it): the installer must
// treat an empty AGENT_CONFIG_HOME as unset, because a scenario cannot remove a variable from the process it starts.

import { execFileSync } from 'node:child_process';
import path from 'node:path';
import type { Fault } from './fault-adapters.ts';
import { faultsFromEnvironment } from './fault-adapters.ts';

export const TEST_ENV = {
  now: 'AGENT_CONFIG_TEST_NOW',
  terminal: 'AGENT_CONFIG_TEST_TERMINAL',
  nodeVersionCommand: 'AGENT_CONFIG_TEST_NODE_VERSION_COMMAND',
  gitVersionCommand: 'AGENT_CONFIG_TEST_GIT_VERSION_COMMAND',
  repo: 'AGENT_CONFIG_TEST_REPO',
} as const;

/** The instant every scenario sees unless it sets another. */
export const defaultNow = '2026-11-20T09:14:03.000Z';

/** The folder of the local bare git repositories of a scenario, under the scenario's temporary folder. */
export function gitSourcesFolder(root: string): string {
  return path.join(root, 'git-sources');
}

/** Path of the local bare repository that stands for a git source named `name`. */
export function gitSourcePath(root: string, name: string): string {
  return path.join(gitSourcesFolder(root), `${name}.git`);
}

/** A clock that always reads the same instant. */
export function fixedClock(instant: Date): { now(): Date } {
  return { now: () => new Date(instant.getTime()) };
}

/** A terminal that is absent (`interactive` false) or gives scripted answers, and remembers what it was asked. */
export interface ScriptedTerminal {
  readonly interactive: boolean;
  readonly asked: string[];
  /** Answers the next scripted answer; rejects when no terminal is attached or the script has run out (it never invents one). */
  ask(question: string): Promise<string>;
}

export function createScriptedTerminal(answers: readonly string[] | null): ScriptedTerminal {
  const asked: string[] = [];
  return {
    interactive: answers !== null,
    asked,
    ask(question: string): Promise<string> {
      if (answers === null)
        return Promise.reject(new Error(`no terminal is attached: "${question}" must not be asked`));
      asked.push(question);
      const answer = answers[asked.length - 1];
      if (answer === undefined) {
        return Promise.reject(
          new Error(`the scripted terminal has no answer for question ${asked.length}: "${question}"`),
        );
      }
      return Promise.resolve(answer);
    },
  };
}

function readNow(text: string | undefined): Date {
  const instant = new Date(text === undefined || text === '' ? defaultNow : text);
  if (Number.isNaN(instant.getTime())) throw new Error(`${TEST_ENV.now}: "${text}" is not a date-time`);
  return instant;
}

function readAnswers(text: string | undefined): string[] | null {
  if (text === undefined || text === '' || text === 'absent') return null;
  const parsed: unknown = JSON.parse(text);
  if (!Array.isArray(parsed) || !parsed.every((a): a is string => typeof a === 'string')) {
    throw new Error(`${TEST_ENV.terminal}: expected "absent" or a JSON array of strings`);
  }
  return parsed;
}

/** Everything the test composition reads from the environment. */
export interface TestSettings {
  now: Date;
  terminal: ScriptedTerminal;
  faults: Fault[];
  /** Script that prints the node version, or undefined to report the real one. */
  nodeVersionCommand: string | undefined;
  /** Script that prints the git version, or undefined to report the real one. */
  gitVersionCommand: string | undefined;
  /** The agent-config checkout under test, or undefined for the repository the installer itself runs from. */
  repo: string | undefined;
}

export function readTestSettings(env: Readonly<Record<string, string | undefined>> = process.env): TestSettings {
  const command = env[TEST_ENV.nodeVersionCommand];
  const gitCommand = env[TEST_ENV.gitVersionCommand];
  const repo = env[TEST_ENV.repo];
  return {
    now: readNow(env[TEST_ENV.now]),
    terminal: createScriptedTerminal(readAnswers(env[TEST_ENV.terminal])),
    faults: faultsFromEnvironment(env),
    nodeVersionCommand: command === undefined || command === '' ? undefined : command,
    gitVersionCommand: gitCommand === undefined || gitCommand === '' ? undefined : gitCommand,
    repo: repo === undefined || repo === '' ? undefined : repo,
  };
}

/** The node version the Runtime port reports: the fake command's output when one is set, else the running node's. */
export function reportedNodeVersion(settings: Pick<TestSettings, 'nodeVersionCommand'>): string {
  if (settings.nodeVersionCommand === undefined) return process.version;
  return execFileSync(process.execPath, [settings.nodeVersionCommand, '--version'], { encoding: 'utf8' }).trim();
}

/** The git version the Runtime port reports: the fake command's output when one is set, else the output of `git --version`. */
export function reportedGitVersion(settings: Pick<TestSettings, 'gitVersionCommand'>): string {
  if (settings.gitVersionCommand === undefined) return execFileSync('git', ['--version'], { encoding: 'utf8' }).trim();
  return execFileSync(process.execPath, [settings.gitVersionCommand, '--version'], { encoding: 'utf8' }).trim();
}
