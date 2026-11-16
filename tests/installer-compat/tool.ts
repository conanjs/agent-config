// tool.ts — the tools under test for tests/installer-compat/compat.feature (specs/022 T125, Story 8) and the steps that only this
// feature uses. Two tools: "installer-compat" is the installer's test entry; "installer-compat-sorting" is the sorting check
// scripts/check-copilot-paths.ts (T149). Step phrases start with "the old path", "the placeholder", "the agent text" or "the sorting".
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { Given, Then, When } from '@cucumber/cucumber';
import { installerRunner } from '../support/installer-world.ts';
import type { InstallerWorld } from '../support/installer-world.ts';
import { scriptRunner } from '../support/tools.ts';
import { registerTool, repo } from '../support/tools.mjs';

const entry = installerRunner('tests/support/installer-test-main.ts');

/** The installer's test entry, told which folder of the scenario stands for the agent-config checkout (core and the public list). */
registerTool('installer-compat', {
  fixture: 'tests/installer-compat/fixtures/base',
  run: (world: InstallerWorld, extra: string[]) => {
    const run = entry(world, extra);
    return { ...run, env: { ...run.env, AGENT_CONFIG_TEST_REPO: world.at('repo') } };
  },
  quietPass: '',
  codes: () => [],
});

/** The sorting check of the hard-coded ~/.copilot lines (T149). */
registerTool('installer-compat-sorting', {
  fixture: 'tests/installer-compat/fixtures/sorting',
  run: scriptRunner('scripts/check-copilot-paths.ts'),
  quietPass: '',
  codes: () => [],
});

interface CompatWorld extends InstallerWorld {
  placeholderLines?: Map<string, string>;
  agentTextHashes?: Record<string, string>;
}

const as = (world: unknown): CompatWorld => world as CompatWorld;
const sha = (text: string): string => createHash('sha256').update(text).digest('hex');
const placeholder = '{{AGENT_HOME}}';

Given('the old path setup lists the path components {string}', function (this: unknown, names: string) {
  const world = as(this);
  const lines = names
    .split(',')
    .map((n) => `  - name: ${n.trim()}\n    source: { type: path, path: ${world.root}/sources/${n.trim()} }`);
  fs.writeFileSync(
    world.at('repo/components.yaml'),
    `schema: components-list/v1\nlocal: false\ncomponents:\n${lines.join('\n')}\n`,
  );
});

Given('the old path setup wires the three agent entry files as the old installer did', function (this: unknown) {
  const world = as(this);
  const home = world.at('home');
  const core = world.at('repo/instructions/core.instructions.md');
  fs.mkdirSync(path.join(home, '.copilot', 'instructions'), { recursive: true });
  fs.symlinkSync(core, path.join(home, '.copilot', 'instructions', 'core.instructions.md'));
  fs.writeFileSync(
    path.join(home, '.claude', 'CLAUDE.md'),
    '# Claude entry\n@~/.copilot/instructions/core.instructions.md\n',
  );
  fs.symlinkSync(core, path.join(home, '.codex', 'AGENTS.md'));
});

Then('the old path {string} shows the same file as {string}', function (this: unknown, old: string, now: string) {
  const world = as(this);
  const a = fs.realpathSync(world.at(old));
  const b = fs.realpathSync(world.at(now));
  assert.equal(a, b);
  assert.ok(fs.readFileSync(a, 'utf8').length > 0, `${old} is empty`);
});

/** Every file under a folder, not following links. */
function files(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    return e.isDirectory() ? files(full) : e.isFile() ? [full] : [];
  });
}

/** The lines that hold the placeholder, with their file and position, as one text. */
function placeholderText(world: CompatWorld, dirs: string[]): string {
  return dirs
    .flatMap((d) => files(world.at(d)))
    .sort()
    .flatMap((f) =>
      fs
        .readFileSync(f, 'utf8')
        .split('\n')
        .map((line, i) => ({ line, at: `${path.relative(world.root, f)}:${i + 1}` }))
        .filter(({ line }) => line.includes(placeholder))
        .map(({ line, at }) => `${at}: ${line}`),
    )
    .join('\n');
}

Given('the placeholder lines under {string} and {string} are recorded', function (this: unknown, a: string, b: string) {
  const world = as(this);
  const text = placeholderText(world, [a, b]);
  assert.ok(text.length > 0, 'the fixture holds no placeholder line');
  (world.placeholderLines ??= new Map()).set(`${a}|${b}`, text);
});

Then(
  'the placeholder lines under {string} and {string} are byte identical to the record',
  function (this: unknown, a: string, b: string) {
    const world = as(this);
    const before = world.placeholderLines?.get(`${a}|${b}`);
    assert.ok(before, 'no record was taken');
    assert.equal(placeholderText(world, [a, b]), before);
  },
);

Then('every placeholder in {string} resolves under the agent home', function (this: unknown, file: string) {
  const world = as(this);
  const text = fs.readFileSync(world.at(file), 'utf8');
  const targets = [...text.matchAll(/\{\{AGENT_HOME\}\}\/([\w./-]+?\.md)/g)].map((m) => m[1] ?? '');
  assert.ok(targets.length > 0, `${file} has no placeholder path`);
  const missing = targets.filter((t) => !fs.existsSync(world.at(path.join('home/.agent-config', t))));
  assert.deepEqual(missing, []);
});

/** The text an agent would receive: its entry file, with each `@~/…` import replaced by the file it names, read through the old path. */
function agentTexts(world: CompatWorld): Record<string, string> {
  const home = world.at('home');
  const read = (file: string): string => {
    try {
      return fs.readFileSync(file, 'utf8');
    } catch {
      return `<missing ${path.relative(home, file)}>`;
    }
  };
  const claude = read(path.join(home, '.claude', 'CLAUDE.md'))
    .split('\n')
    .map((line) => (line.startsWith('@~/') ? read(path.join(home, line.slice(3))) : line))
    .join('\n');
  return {
    'claude-code': claude,
    'copilot-cli': read(path.join(home, '.copilot', 'instructions', 'core.instructions.md')),
    codex: read(path.join(home, '.codex', 'AGENTS.md')),
  };
}

Given('the agent text hashes are recorded', function (this: unknown) {
  const world = as(this);
  world.agentTextHashes = Object.fromEntries(Object.entries(agentTexts(world)).map(([k, v]) => [k, sha(v)]));
  for (const [agent, text] of Object.entries(agentTexts(world)))
    assert.ok(
      !text.startsWith('<missing') && !text.includes('<missing'),
      `${agent} receives no text before the install`,
    );
});

Then('the agent text hashes are unchanged', function (this: unknown) {
  const world = as(this);
  const now = Object.fromEntries(Object.entries(agentTexts(world)).map(([k, v]) => [k, sha(v)]));
  assert.deepEqual(now, world.agentTextHashes);
});

Then('the agent text hash of every agent has changed', function (this: unknown) {
  const world = as(this);
  const now = Object.fromEntries(Object.entries(agentTexts(world)).map(([k, v]) => [k, sha(v)]));
  for (const [agent, hash] of Object.entries(now)) assert.notEqual(hash, world.agentTextHashes?.[agent], agent);
});

/** The result of running the sorting check on the repository itself (the shared steps read `world.result`). */
When('the sorting check runs on the repository', function (this: unknown) {
  const world = as(this);
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')));
  try {
    const out = execFileSync(process.execPath, [path.join(repo, 'scripts/check-copilot-paths.ts')], {
      encoding: 'utf8',
      env,
      stdio: 'pipe',
    });
    world.result = { code: 0, out: out.trimEnd() };
  } catch (error) {
    const failure = error as { status?: number; stdout?: string; stderr?: string };
    world.result = { code: failure.status ?? 1, out: `${failure.stdout ?? ''}${failure.stderr ?? ''}`.trimEnd() };
  }
});
