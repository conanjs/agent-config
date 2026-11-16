// tool.ts — steps of tests/installer-security/security.feature (specs/022 T127): negative security scenarios named by mitigation id.
// Same composition as the other installer features: the test entry tests/support/installer-test-main.ts (T142) reads the fixture clone
// of agent-config from AGENT_CONFIG_TEST_REPO ({root}/repo here), and https://example.invalid/<name>.git is the local bare repository
// {root}/git-sources/<name>.git (git url rewrite set here).
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { Given, Then } from '@cucumber/cucumber';
import { gitSourcePath, gitSourcesFolder } from '../support/installer-test-settings.ts';
import { gitSourceHead, installerRunner } from '../support/installer-world.ts';
import type { InstallerWorld } from '../support/installer-world.ts';
import { registerTool } from '../support/tools.mjs';
import type { ToolWorld } from '../support/tools.ts';

registerTool('installer-security', {
  fixture: 'tests/installer-security/fixtures/base',
  run: (world: InstallerWorld, extra: string[]) => {
    const run = installerRunner('tests/support/installer-test-main.ts')(world, extra);
    return {
      ...run,
      env: {
        ...run.env,
        AGENT_CONFIG_TEST_REPO: world.at('repo'),
        GIT_CONFIG_COUNT: '1',
        GIT_CONFIG_KEY_0: `url.${gitSourcesFolder(world.root)}/.insteadOf`,
        GIT_CONFIG_VALUE_0: 'https://example.invalid/',
        ...((world as { extraEnv?: Record<string, string> }).extraEnv ?? {}),
      },
    };
  },
  quietPass: '',
  codes: () => [],
});

Given('the security home is confirmed', function (this: unknown) {
  const world = this as ToolWorld;
  const file = world.at('home/.agent-config/install-state.json');
  const state = {
    approved_privileged_hash: null,
    components: {},
    entries: [],
    home: world.at('home/.agent-config'),
    installer: { commit: '825ea82000000000000000000000000000000000', version: '0.2.0' },
    last_run: { command: 'install', exit: 0, time: '2026-11-19T09:00:00.000Z' },
    schema: 'install-state/v1',
  };
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(state, null, 2) + '\n');
});

/** Writes home/.agent-config/components.local.yaml with one path source per name, each at {root}/home/src/<name>. */
Given('the security local list holds the path components {string}', function (this: unknown, names: string) {
  const world = this as ToolWorld;
  const lines = names
    .split(',')
    .map((n) => n.trim())
    .map((n) => `  - { name: ${n}, source: { type: path, path: '${world.at(`home/src/${n}`)}' } }`);
  const file = world.at('home/.agent-config/components.local.yaml');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, ['schema: components-list/v1', 'local: true', 'components:', ...lines, ''].join('\n'));
});

// ---- steps of tests/installer-security/security.feature ------------------------------------------------

type Out = { out: string };
const outputOf = (world: unknown): string => {
  const { result } = world as { result?: Out };
  assert.ok(result, 'the tool has not run');
  return result.out;
};

Then('the security output has no line containing {string}', function (this: unknown, text: string) {
  const hit = outputOf(this)
    .split('\n')
    .find((line) => line.includes(text));
  assert.equal(hit, undefined, `the output has a line containing "${text}": ${hit}`);
});

Then('the security output has a line containing {string}', function (this: unknown, text: string) {
  assert.ok(
    outputOf(this)
      .split('\n')
      .some((line) => line.includes(text)),
    `no output line contains "${text}":\n${outputOf(this)}`,
  );
});

Then('the security output has a line starting with {string}', function (this: unknown, start: string) {
  assert.ok(
    outputOf(this)
      .split('\n')
      .some((line) => line.startsWith(start)),
    `no output line starts with "${start}":\n${outputOf(this)}`,
  );
});

Then('the security output has a line matching {string}', function (this: unknown, pattern: string) {
  const re = new RegExp(pattern);
  assert.ok(
    outputOf(this)
      .split('\n')
      .some((line) => re.test(line)),
    `no output line matches ${pattern}:\n${outputOf(this)}`,
  );
});

Then('the security output names the newest commit of the git source {string}', function (this: unknown, name: string) {
  assert.ok(
    outputOf(this).includes(gitSourceHead(this as InstallerWorld, name)),
    `the output does not name the newest commit of ${name}`,
  );
});

function filesIn(target: string): string[] {
  if (!fs.existsSync(target)) return [];
  const stat = fs.lstatSync(target);
  if (stat.isSymbolicLink()) return [];
  if (!stat.isDirectory()) return [target];
  return fs.readdirSync(target).flatMap((name) => filesIn(path.join(target, name)));
}

Then(
  'the security tree {string} holds no file containing {string}',
  function (this: unknown, target: string, text: string) {
    const world = this as ToolWorld;
    const hits = filesIn(world.at(target)).filter((f) => fs.readFileSync(f, 'utf8').includes(text));
    assert.deepEqual(hits, [], `files containing "${text}"`);
  },
);

Then(
  'the security file {string} holds exactly the text {string}',
  function (this: unknown, file: string, text: string) {
    assert.equal(fs.readFileSync((this as ToolWorld).at(file), 'utf8'), text);
  },
);

Then('the security file {string} has {int} lines', function (this: unknown, file: string, count: number) {
  const lines = fs
    .readFileSync((this as ToolWorld).at(file), 'utf8')
    .split('\n')
    .filter((l) => l !== '');
  assert.equal(lines.length, count);
});

Given(
  'the security file {string} grows to {int} bytes with comment lines',
  function (this: unknown, file: string, bytes: number) {
    const full = (this as ToolWorld).at(file);
    const line = `# ${'x'.repeat(78)}\n`;
    fs.appendFileSync(full, line.repeat(Math.ceil(bytes / line.length)));
  },
);

Given('the security link {string} points to {string}', function (this: unknown, link: string, target: string) {
  const world = this as ToolWorld;
  fs.mkdirSync(path.dirname(world.at(link)), { recursive: true });
  fs.symlinkSync(world.at(target), world.at(link));
});

Given(
  'the security lock file is held by {string} since {string}',
  function (this: unknown, command: string, started: string) {
    const world = this as ToolWorld;
    const file = world.at('home/.agent-config/install.lock');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify({ command, pid: 4242, started }) + '\n');
  },
);

Given('the security approval variables are set', function (this: unknown) {
  (this as { extraEnv?: Record<string, string> }).extraEnv = {
    AGENT_CONFIG_APPROVE: 'yes',
    AGENT_CONFIG_ASSUME_YES: '1',
    CI: 'true',
    YES: 'yes',
  };
});

// A tag a scenario moves: git tag -f in the bare repository of the source.
Given(
  'the security tag {string} of the git source {string} is moved to the newest commit',
  function (this: unknown, tag: string, name: string) {
    const world = this as InstallerWorld;
    const bare = gitSourcePath(world.root, name);
    execFileSync('git', ['-C', bare, 'tag', '-f', tag, 'refs/heads/main'], {
      stdio: 'pipe',
      env: gitEnvironment(world),
    });
  },
);

function gitEnvironment(world: ToolWorld): NodeJS.ProcessEnv {
  const config = world.at('git-config-empty');
  if (!fs.existsSync(config)) fs.writeFileSync(config, '');
  return {
    ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_'))),
    GIT_CONFIG_GLOBAL: config,
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_AUTHOR_NAME: 'Vinh Do',
    GIT_AUTHOR_EMAIL: 'v@example.invalid',
    GIT_COMMITTER_NAME: 'Vinh Do',
    GIT_COMMITTER_EMAIL: 'v@example.invalid',
    GIT_AUTHOR_DATE: '2026-11-02T00:00:00Z',
    GIT_COMMITTER_DATE: '2026-11-02T00:00:00Z',
  };
}

// A symbolic link committed into a git source (the world's own step writes files only).
Given(
  'the security git source {string} commits a symlink {string} to {string}',
  function (this: unknown, name: string, link: string, target: string) {
    const world = this as InstallerWorld;
    const work = world.at(path.join('git-work', name));
    fs.mkdirSync(path.dirname(path.join(work, link)), { recursive: true });
    fs.symlinkSync(target, path.join(work, link));
    const run = (...args: string[]): void =>
      void execFileSync('git', ['-C', work, ...args], { stdio: 'pipe', env: gitEnvironment(world) });
    run('add', '-A');
    run('-c', 'commit.gpgsign=false', 'commit', '-q', '-m', `link ${link}`);
    run('push', '-q', gitSourcePath(world.root, name), 'main');
  },
);

// ---- permissions and the log ----------------------------------------------------------------------------

Then('the security mode of {string} is {string}', function (this: unknown, target: string, mode: string) {
  assert.equal((fs.statSync((this as ToolWorld).at(target)).mode & 0o777).toString(8), mode);
});

Then('the security backups under {string} are owner-only', function (this: unknown, root: string) {
  const world = this as ToolWorld;
  const walk = (dir: string): void => {
    assert.equal((fs.statSync(dir).mode & 0o777).toString(8), '700', `${dir} is not 700`);
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else assert.equal((fs.statSync(full).mode & 0o777).toString(8), '600', `${full} is not 600`);
    }
  };
  assert.ok(fs.readdirSync(world.at(root)).length > 0, `no backup under ${root}`);
  walk(world.at(root));
});

function lastLogLine(world: ToolWorld): Record<string, unknown> {
  const lines = fs
    .readFileSync(world.at('home/.agent-config/install-log.jsonl'), 'utf8')
    .split('\n')
    .filter((l) => l !== '');
  const parsed: unknown = JSON.parse(lines.at(-1) ?? 'null');
  assert.ok(parsed !== null && typeof parsed === 'object', 'the last log line is not a JSON object');
  return parsed as Record<string, unknown>;
}

Then(
  'the security last log line is for the command {string} with exit {int} at {string}',
  function (this: unknown, command: string, exit: number, time: string) {
    const line = lastLogLine(this as ToolWorld);
    assert.equal(line['command'], command);
    assert.equal(line['exit'], exit);
    assert.equal(new Date(String(line['time'])).getTime(), new Date(time).getTime());
  },
);

Then(
  'the security last log line lists the component {string} from {string} going from {string} to {string}',
  function (this: unknown, name: string, source: string, before: string, after: string) {
    const world = this as ToolWorld;
    const components = lastLogLine(world)['components'];
    assert.ok(Array.isArray(components), 'the log line has no components list');
    assert.deepEqual(
      components.find((c: { name?: string }) => c.name === name),
      {
        name,
        source: source.replaceAll('{root}', world.root),
        commit_before: before === 'none' ? null : before,
        commit_after: after,
      },
    );
  },
);

Then('the security approved privileged set is {string}', function (this: unknown, which: string) {
  const state: unknown = JSON.parse(
    fs.readFileSync((this as ToolWorld).at('home/.agent-config/install-state.json'), 'utf8'),
  );
  const hash = (state as { approved_privileged_hash?: unknown }).approved_privileged_hash;
  if (which === 'none') assert.equal(hash, null);
  else assert.match(String(hash), /^[0-9a-f]{8,}$/);
});

Given('the security approved privileged set is remembered', function (this: unknown) {
  const world = this as ToolWorld & { remembered?: unknown };
  const state: unknown = JSON.parse(fs.readFileSync(world.at('home/.agent-config/install-state.json'), 'utf8'));
  world.remembered = (state as { approved_privileged_hash?: unknown }).approved_privileged_hash;
});

Then('the security approved privileged set is the one remembered', function (this: unknown) {
  const world = this as ToolWorld & { remembered?: unknown };
  const state: unknown = JSON.parse(fs.readFileSync(world.at('home/.agent-config/install-state.json'), 'utf8'));
  assert.equal((state as { approved_privileged_hash?: unknown }).approved_privileged_hash, world.remembered);
});
