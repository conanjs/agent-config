// installer-world.ts — the scenario world of the installer (specs/022 T117), on top of tests/support/tools.ts.
//
// A scenario gets, with no network and no real home, clock or terminal:
//   - a temporary home and the agent folders under it: `agentFolders(world)` and the step
//     "a temporary home with the agent folders exists" (home/.claude, .copilot, .codex, .agents/skills; the agent home
//     home/.agent-config and the backups folder home/.agent-config-backups are NOT created: the installer makes them);
//   - local bare git repositories as git sources: `createGitSource` and the steps "a local git source {string} with these
//     files:" (a table with the columns path and content; `\n` in content is a line break), "the git source {string} gets a
//     new commit that sets {string} to {string}", "the git source {string} is tagged {string}". The repository of a source
//     named core is {root}/git-sources/core.git; its commits have fixed names, dates and messages, so the same files give
//     the same commit id on every machine;
//   - a replaceable node version command: "the node version command reports {string}";
//   - a replaceable git version command: "the git version command reports {string}";
//   - a fixed clock (also between two runs of one scenario): "the clock is fixed at {string}" (default 2026-11-20T09:14:03.000Z);
//   - a scripted terminal: "a scripted terminal that answers:" (one answer per line) or "no terminal is attached" (default);
//   - faults (fault-adapters.ts): "the installer fails write number {int}", "the installer cannot create links",
//     "fetching the component {string} fails", "the installer process is killed after link switch {int}",
//     "the installer process is killed at {string}" (before-first-switch, after-switch:<k>, mid-switch:<k>, before-commit),
//     "the installer fails the write of {string}" (a path suffix), "the installer cannot create symlinks" / "junctions";
//     "the installer runs without faults from now on" clears every fault;
//   - the agent home variable: "the agent home variable is {string}" ({root} stands for the temporary folder);
//   - exact text compare with timestamps normalized: the steps of tools.ts ("the output equals, ignoring timestamps:").
// `installerRunner(entry)` is the `run` of registerTool: it starts `node <entry> <args>` with HOME and USERPROFILE set to the
// temporary home, git isolated from the real git configuration, and the test settings of the World in the environment
// variables of installer-test-settings.ts and fault-adapters.ts. An installer feature registers
// `run: installerRunner('tests/support/installer-test-main.ts')`; the entry installers/core/main.ts is what the production
// scenario of the guard uses. Steps that only read are in tools.ts and steps.mjs ("the tool runs with …", "it exits with …").
//
// Rule for scenarios (QB-4, QB-8): never name a real user, URL or token; sources are local paths, users are `Vinh Do` and `v`.

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { Given, Then } from '@cucumber/cucumber';
import type { DataTable } from '@cucumber/cucumber';
import { formatFaults, FAULT_ENV, parseFaults } from './fault-adapters.ts';
import type { Fault } from './fault-adapters.ts';
import { defaultNow, gitSourcePath, TEST_ENV } from './installer-test-settings.ts';
import { findSeamLeaks, formatSeamLeaks } from './seam-guard.ts';
import { scriptRunner, temporaryHome } from './tools.ts';
import type { ToolWorld } from './tools.ts';
import { repo } from './tools.mjs';

/** The scenario World as the installer steps use it. */
export interface InstallerWorld extends ToolWorld {
  faults?: Fault[];
  /** Answers of the scripted terminal; undefined or null means no terminal is attached. */
  terminalAnswers?: string[] | null;
  now?: string;
  /** Path of the fake node version command, when a scenario set one. */
  nodeVersionCommand?: string;
  /** Path of the fake git version command, when a scenario set one. */
  gitVersionCommand?: string;
  /** The AGENT_CONFIG_HOME of the run; empty means unset. */
  agentHomeVariable?: string;
  gitSources?: Map<string, { commits: number }>;
}

export interface AgentFolders {
  home: string;
  agentHome: string;
  backups: string;
  claude: string;
  copilot: string;
  codex: string;
  agentsSkills: string;
}

/** Creates the temporary home with the agent folders (not the agent home or the backups) and returns every path. */
export function agentFolders(world: Pick<ToolWorld, 'at'>): AgentFolders {
  const home = temporaryHome(world);
  const folders: AgentFolders = {
    home,
    agentHome: path.join(home, '.agent-config'),
    backups: path.join(home, '.agent-config-backups'),
    claude: path.join(home, '.claude'),
    copilot: path.join(home, '.copilot'),
    codex: path.join(home, '.codex'),
    agentsSkills: path.join(home, '.agents', 'skills'),
  };
  for (const dir of [folders.claude, folders.copilot, folders.codex, folders.agentsSkills])
    fs.mkdirSync(dir, { recursive: true });
  return folders;
}

// ---- Git sources -------------------------------------------------------------------------------------

const gitName = /^[a-z0-9][a-z0-9-]{0,63}$/;
// Fixed identity and dates: the same files and message give the same commit id everywhere (git writes no machine data).
const firstCommit = Date.UTC(2026, 10, 1, 0, 0, 0);

/** An empty git configuration file outside the home, so the real ~/.gitconfig (credentials, autocrlf, hooks) never applies. */
function emptyGitConfig(world: Pick<ToolWorld, 'at'>): string {
  const file = world.at('git-config-empty');
  if (!fs.existsSync(file)) fs.writeFileSync(file, '');
  return file;
}

/** Environment for git: the outer GIT_* variables removed, the real git configuration shut out, no prompts. */
function gitEnvironment(world: Pick<ToolWorld, 'at'>, commits = 0): NodeJS.ProcessEnv {
  const date = new Date(firstCommit + commits * 60_000).toISOString();
  return {
    ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_'))),
    GIT_CONFIG_GLOBAL: emptyGitConfig(world),
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_TERMINAL_PROMPT: '0',
    GIT_AUTHOR_NAME: 'Vinh Do',
    GIT_AUTHOR_EMAIL: 'v@example.invalid',
    GIT_COMMITTER_NAME: 'Vinh Do',
    GIT_COMMITTER_EMAIL: 'v@example.invalid',
    GIT_AUTHOR_DATE: date,
    GIT_COMMITTER_DATE: date,
  };
}

function git(world: InstallerWorld, cwd: string, commits: number, ...args: string[]): string {
  return execFileSync('git', ['-C', cwd, ...args], {
    encoding: 'utf8',
    env: gitEnvironment(world, commits),
    stdio: 'pipe',
  }).trim();
}

function workTree(world: ToolWorld, name: string): string {
  return world.at(path.join('git-work', name));
}

function sourceState(world: InstallerWorld, name: string): { commits: number } {
  const state = world.gitSources?.get(name);
  assert.ok(state, `no git source "${name}" was created`);
  return state;
}

function writeFiles(dir: string, files: Readonly<Record<string, string>>): void {
  for (const [file, content] of Object.entries(files)) {
    assert.ok(
      !path.isAbsolute(file) && !file.split(/[\\/]/).includes('..'),
      `"${file}" must be a relative path with no ".."`,
    );
    fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    fs.writeFileSync(path.join(dir, file), content);
  }
}

/** Commits `files` to the working copy of a source and pushes the branch to its bare repository. */
function commitFiles(
  world: InstallerWorld,
  name: string,
  files: Readonly<Record<string, string>>,
  message: string,
): void {
  const state = sourceState(world, name);
  const work = workTree(world, name);
  writeFiles(work, files);
  state.commits += 1;
  git(world, work, state.commits, 'add', '-A');
  git(world, work, state.commits, '-c', 'commit.gpgsign=false', 'commit', '-q', '-m', message);
  git(world, work, state.commits, 'push', '-q', gitSourcePath(world.root, name), 'main');
}

/**
 * Creates the git source `name`: a working copy with one commit holding `files`, and the bare repository
 * {root}/git-sources/<name>.git that the installer fetches from. Returns the bare repository's path.
 */
export function createGitSource(world: InstallerWorld, name: string, files: Readonly<Record<string, string>>): string {
  assert.match(name, gitName, `"${name}" is not a valid source name`);
  assert.ok(!world.gitSources?.has(name), `git source "${name}" already exists`);
  const work = workTree(world, name);
  const bare = gitSourcePath(world.root, name);
  fs.mkdirSync(work, { recursive: true });
  fs.mkdirSync(path.dirname(bare), { recursive: true });
  git(world, work, 0, 'init', '-q', '-b', 'main');
  git(world, work, 0, 'init', '-q', '--bare', '-b', 'main', bare);
  (world.gitSources ??= new Map()).set(name, { commits: 0 });
  commitFiles(world, name, files, 'first commit');
  return bare;
}

/** Adds a commit that sets one file to `content`. */
export function addGitCommit(world: InstallerWorld, name: string, file: string, content: string): void {
  commitFiles(world, name, { [file]: content }, `set ${file}`);
}

/** Tags the newest commit of a source in its bare repository. */
export function tagGitSource(world: InstallerWorld, name: string, tag: string): void {
  assert.match(tag, /^[A-Za-z0-9][A-Za-z0-9._-]*$/, `"${tag}" is not a valid tag`);
  const state = sourceState(world, name);
  git(world, workTree(world, name), state.commits, 'tag', tag);
  git(world, workTree(world, name), state.commits, 'push', '-q', gitSourcePath(world.root, name), `refs/tags/${tag}`);
}

/** The commit id the branch main of a source points at. */
export function gitSourceHead(world: InstallerWorld, name: string): string {
  return git(world, gitSourcePath(world.root, name), 0, 'rev-parse', 'refs/heads/main');
}

// ---- The environment of a run ------------------------------------------------------------------------

/** The environment variables the World gives the installer process (merged into the process environment by the shared steps). */
export function installerEnvironment(world: InstallerWorld): Record<string, string> {
  const home = temporaryHome(world);
  return {
    HOME: home,
    USERPROFILE: home,
    AGENT_CONFIG_HOME: world.agentHomeVariable ?? '',
    GIT_CONFIG_GLOBAL: emptyGitConfig(world),
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_TERMINAL_PROMPT: '0',
    [TEST_ENV.now]: world.now ?? defaultNow,
    [TEST_ENV.terminal]: world.terminalAnswers ? JSON.stringify(world.terminalAnswers) : 'absent',
    [TEST_ENV.nodeVersionCommand]: world.nodeVersionCommand ?? '',
    [TEST_ENV.gitVersionCommand]: world.gitVersionCommand ?? '',
    [FAULT_ENV]: formatFaults(world.faults ?? []),
  };
}

/** The `run` entry of registerTool for an installer entry (a path under the repository): node runs it with the World's environment. */
export function installerRunner(entry: string) {
  const start = scriptRunner('tests/support/launchers/signal-exit.ts');
  return (
    world: InstallerWorld,
    extraArgs: string[],
  ): { file: string; args: string[]; env: Record<string, string> } => {
    const run = start(world, [path.join(repo, entry), ...extraArgs]);
    return { ...run, env: { ...run.env, ...installerEnvironment(world) } };
  };
}

/** Writes the fake node version command into the scenario folder and returns its path (a .mjs file, so it runs on every OS). */
function fakeVersionCommand(world: ToolWorld, name: string, version: string): string {
  const file = world.at(path.join('bin', `${name}-version.mjs`));
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `console.log(${JSON.stringify(version)});\n`);
  return file;
}

// ---- Steps -------------------------------------------------------------------------------------------

const unescapeLines = (text: string): string => text.replace(/\\n/g, '\n');
const fillRoot = (world: ToolWorld, text: string): string => text.replaceAll('{root}', world.root);

Given('a temporary home with the agent folders exists', function (this: unknown) {
  agentFolders(this as InstallerWorld);
});

Given('a local git source {string} with these files:', function (this: unknown, name: string, table: DataTable) {
  const files = Object.fromEntries(
    table.hashes().map((row) => [row['path'] ?? '', unescapeLines(row['content'] ?? '') + '\n']),
  );
  createGitSource(this as InstallerWorld, name, files);
});

Given(
  'the git source {string} gets a new commit that sets {string} to {string}',
  function (this: unknown, name: string, file: string, content: string) {
    addGitCommit(this as InstallerWorld, name, file, unescapeLines(content) + '\n');
  },
);

Given('the git source {string} is tagged {string}', function (this: unknown, name: string, tag: string) {
  tagGitSource(this as InstallerWorld, name, tag);
});

Given('the clock is fixed at {string}', function (this: unknown, instant: string) {
  assert.ok(!Number.isNaN(new Date(instant).getTime()), `"${instant}" is not a date-time`);
  (this as InstallerWorld).now = instant;
});

Given('the node version command reports {string}', function (this: unknown, version: string) {
  const world = this as InstallerWorld;
  world.nodeVersionCommand = fakeVersionCommand(world, 'node', version);
});

Given('the git version command reports {string}', function (this: unknown, version: string) {
  const world = this as InstallerWorld;
  world.gitVersionCommand = fakeVersionCommand(world, 'git', version);
});

Given('a scripted terminal that answers:', function (this: unknown, doc: string) {
  (this as InstallerWorld).terminalAnswers = doc.split('\n').map((line) => line.trim());
});

Given('no terminal is attached', function (this: unknown) {
  (this as InstallerWorld).terminalAnswers = null;
});

Given('the agent home variable is {string}', function (this: unknown, value: string) {
  const world = this as InstallerWorld;
  world.agentHomeVariable = fillRoot(world, value);
});

function addFault(world: unknown, fault: Fault): void {
  ((world as InstallerWorld).faults ??= []).push(fault);
}

Given('the installer fails write number {int}', function (this: unknown, n: number) {
  addFault(this, { kind: 'fail-nth-write', n });
});

Given('the installer cannot create links', function (this: unknown) {
  addFault(this, { kind: 'links-not-permitted' });
});

Given('fetching the component {string} fails', function (this: unknown, component: string) {
  addFault(this, { kind: 'fetch-fails', component });
});

Given('the installer process is killed after link switch {int}', function (this: unknown, n: number) {
  addFault(this, { kind: 'kill', point: 'after-switch', n });
});

Given('the installer process is killed at {string}', function (this: unknown, point: string) {
  for (const fault of parseFaults(`kill-at:${point}`)) addFault(this, fault);
});

Given('the installer fails the write of {string}', function (this: unknown, suffix: string) {
  addFault(this, { kind: 'fail-write-at', suffix });
});

Given('the installer cannot create symlinks', function (this: unknown) {
  addFault(this, { kind: 'links-not-permitted', linkKind: 'symlink' });
});

Given('the installer cannot create junctions', function (this: unknown) {
  addFault(this, { kind: 'links-not-permitted', linkKind: 'junction' });
});

Given('the installer runs without faults from now on', function (this: unknown) {
  (this as InstallerWorld).faults = [];
});

Then(
  'the folder {string} is a clone of the git source {string}',
  function (this: unknown, folder: string, name: string) {
    const world = this as InstallerWorld;
    assert.equal(git(world, world.at(folder), 0, 'rev-parse', 'HEAD'), gitSourceHead(world, name));
    assert.equal(git(world, world.at(folder), 0, 'config', 'remote.origin.url'), gitSourcePath(world.root, name));
  },
);

Then(
  'the git source {string} is at the same commit as {string}',
  function (this: unknown, name: string, other: string) {
    const world = this as InstallerWorld;
    assert.equal(gitSourceHead(world, name), gitSourceHead(world, other));
  },
);

Then(
  'the git source {string} is not at the same commit as {string}',
  function (this: unknown, name: string, other: string) {
    const world = this as InstallerWorld;
    assert.notEqual(gitSourceHead(world, name), gitSourceHead(world, other));
  },
);

Then('the git source {string} has the tag {string}', function (this: unknown, name: string, tag: string) {
  const world = this as InstallerWorld;
  assert.match(
    git(world, gitSourcePath(world.root, name), 0, 'rev-parse', `refs/tags/${tag}^{commit}`),
    /^[0-9a-f]{40}$/,
  );
});

Then(
  'the tag {string} of the git source {string} is not the newest commit',
  function (this: unknown, tag: string, name: string) {
    const world = this as InstallerWorld;
    assert.notEqual(
      git(world, gitSourcePath(world.root, name), 0, 'rev-parse', `refs/tags/${tag}^{commit}`),
      gitSourceHead(world, name),
    );
  },
);

Then('the output does not mention {string}', function (this: unknown, text: string) {
  const { result } = this as ToolWorld;
  assert.ok(result, 'the tool has not run');
  assert.ok(!result.out.includes(text), `the output mentions "${text}":\n${result.out}`);
});

Then('it does not exit with {int}', function (this: unknown, code: number) {
  const { result } = this as ToolWorld;
  assert.ok(result, 'the tool has not run');
  assert.notEqual(result.code, code);
});

Then('the production tiers of the repository name no test seam', function () {
  assert.deepEqual(formatSeamLeaks(findSeamLeaks(repo)), []);
});
