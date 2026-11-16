// tool.ts — the installer under test for tests/installer-safety/safety.feature (specs/022 T124, Story 7), and the steps
// that only this feature uses. The installer does not exist yet: the scenarios are @pending until its tasks are done.
// Step phrases start with a word that marks this area: "the safety list", "the backup", "the mode", "the mtimes", "the links",
// "the report", "the remembered", "the owner-only", "the access list".
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { Given, Then } from '@cucumber/cucumber';
import { gitSourcesFolder } from '../support/installer-test-settings.ts';
import { installerRunner } from '../support/installer-world.ts';
import type { InstallerWorld } from '../support/installer-world.ts';
import { diffTrees, snapshotTree } from '../support/tools.ts';
import { registerTool } from '../support/tools.mjs';

const fixture = 'tests/installer-safety/fixtures/base';
const entry = installerRunner('tests/support/installer-test-main.ts');

/** The installer's test entry, told which folder of the scenario stands for the agent-config checkout (core and the public list). */
registerTool('installer-safety', {
  fixture,
  run: (world: InstallerWorld, extra: string[]) => {
    const run = entry(world, extra);
    return {
      ...run,
      env: {
        ...run.env,
        AGENT_CONFIG_TEST_REPO: world.at('repo'),
        // A list names a git source as https://example.invalid/<name>.git, the only form the list schema accepts; git maps it to the bare repository.
        GIT_CONFIG_COUNT: '2',
        GIT_CONFIG_KEY_0: `url.${gitSourcesFolder(world.root)}/.insteadOf`,
        GIT_CONFIG_VALUE_0: 'https://example.invalid/',
        GIT_CONFIG_KEY_1: 'protocol.file.allow',
        GIT_CONFIG_VALUE_1: 'always',
      },
    };
  },
  quietPass: '',
  codes: () => [],
});

/** Extra state of a scenario that only this feature keeps. */
interface SafetyWorld extends InstallerWorld {
  recordedLinks?: Map<string, string[]>;
  remembered?: { report?: string; files?: Map<string, string> };
}

const as = (world: unknown): SafetyWorld => world as SafetyWorld;
const sha = (file: string): string => createHash('sha256').update(fs.readFileSync(file)).digest('hex');

/** Every entry under a folder (not following links), as absolute paths. */
function walk(dir: string): string[] {
  const found: string[] = [];
  for (const name of fs.readdirSync(dir).sort()) {
    const full = path.join(dir, name);
    found.push(full);
    if (fs.lstatSync(full).isDirectory()) found.push(...walk(full));
  }
  return found;
}

/** The installer writes this file on every run, by append or by lock, so a rerun may change it. */
const runLogs = new Set(['install-log.jsonl', 'install.lock']);

Given('the safety list names the path components {string}', function (this: unknown, names: string) {
  const world = as(this);
  const lines = names
    .split(',')
    .map((n) => `  - name: ${n.trim()}\n    source: { type: path, path: ${world.root}/sources/${n.trim()} }`);
  fs.mkdirSync(world.at('repo'), { recursive: true });
  fs.writeFileSync(
    world.at('repo/components.yaml'),
    `schema: components-list/v1\nlocal: false\ncomponents:\n${lines.join('\n')}\n`,
  );
});

Given('the mode of {string} is set to {string}', function (this: unknown, file: string, mode: string) {
  fs.chmodSync(as(this).at(file), Number.parseInt(mode, 8));
});

Then('the mode of {string} is {string}', function (this: unknown, file: string, mode: string) {
  assert.equal((fs.lstatSync(as(this).at(file)).mode & 0o777).toString(8), mode);
});

Then('the owner-only modes hold under {string}', function (this: unknown, dir: string) {
  const world = as(this);
  const wrong = [world.at(dir), ...walk(world.at(dir))]
    .filter((p) => !fs.lstatSync(p).isSymbolicLink())
    .map((p) => ({ p, mode: fs.lstatSync(p).mode & 0o777, dir: fs.lstatSync(p).isDirectory() }))
    .filter(({ mode, dir: isDir }) => mode !== (isDir ? 0o700 : 0o600))
    .map(({ p, mode }) => `${path.relative(world.root, p)} is ${mode.toString(8)}`);
  assert.deepEqual(wrong, []);
});

Then('the access list of {string} grants no other user and is not inherited', function (this: unknown, dir: string) {
  const out = execFileSync('icacls', [as(this).at(dir)], { encoding: 'utf8' });
  assert.ok(!/Everyone|BUILTIN\\Users|Authenticated Users/.test(out), out);
  assert.ok(!/\(I\)/.test(out), `inherited entries:\n${out}`);
});

Given('the mtimes under {string} are set back to 2001', function (this: unknown, dir: string) {
  const old = new Date('2001-01-01T00:00:00Z');
  for (const p of walk(as(this).at(dir)))
    if (fs.lstatSync(p).isSymbolicLink()) fs.lutimesSync(p, old, old);
    else fs.utimesSync(p, old, old);
});

Then('no mtime under {string} changed, apart from the run logs', function (this: unknown, dir: string) {
  const world = as(this);
  const touched = walk(world.at(dir))
    .filter((p) => !runLogs.has(path.basename(p)))
    .filter((p) => fs.lstatSync(p).mtime.getUTCFullYear() !== 2001)
    .map((p) => path.relative(world.root, p));
  assert.deepEqual(touched, [], 'these were rewritten or replaced');
});

Given('the links under {string} are recorded', function (this: unknown, dir: string) {
  const world = as(this);
  const links = walk(world.at(dir))
    .filter((p) => fs.lstatSync(p).isSymbolicLink())
    .map((p) => `${path.relative(world.root, p)} -> ${fs.readlinkSync(p)}`);
  (world.recordedLinks ??= new Map()).set(dir, links);
});

Then('the links under {string} are as recorded', function (this: unknown, dir: string) {
  const world = as(this);
  const before = world.recordedLinks?.get(dir);
  assert.ok(before, `no links of "${dir}" were recorded`);
  const now = walk(world.at(dir))
    .filter((p) => fs.lstatSync(p).isSymbolicLink())
    .map((p) => `${path.relative(world.root, p)} -> ${fs.readlinkSync(p)}`);
  assert.deepEqual(now, before);
});

Given('the report is remembered', function (this: unknown) {
  const world = as(this);
  assert.ok(world.result, 'the tool has not run');
  (world.remembered ??= {}).report = world.result.out;
});

Then('the report equals the remembered report', function (this: unknown) {
  const world = as(this);
  assert.ok(world.result && world.remembered?.report !== undefined, 'nothing was remembered');
  assert.equal(world.result.out, world.remembered.report);
});

Then('the report has a line starting with {string}', function (this: unknown, start: string) {
  const out = as(this).result?.out ?? '';
  assert.ok(
    out.split('\n').some((l) => l.startsWith(start)),
    `no line starts with "${start}" in:\n${out}`,
  );
});

Then('the report has no line starting with {string}', function (this: unknown, start: string) {
  const out = as(this).result?.out ?? '';
  assert.deepEqual(
    out.split('\n').filter((l) => l.startsWith(start)),
    [],
  );
});

Then('the report field {string} is {string}', function (this: unknown, field: string, value: string) {
  const out = as(this).result?.out ?? '';
  const json = JSON.parse(out.replaceAll('{root}', as(this).root)) as Record<string, unknown>;
  assert.equal(String(json[field]), value);
});

/** The backup manifest of a backup folder: items with the original path, the copy's path inside the folder, kind and hash. */
interface BackupItem {
  original: string;
  backup: string;
  kind: string;
  hash: string;
}

function manifestOf(world: SafetyWorld, stamp: string): { dir: string; items: BackupItem[] } {
  const dir = world.at(`home/.agent-config-backups/${stamp}`);
  const file = path.join(dir, 'backup-manifest.json');
  assert.ok(fs.existsSync(file), `no backup-manifest.json in ${path.relative(world.root, dir)}`);
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as { items: BackupItem[] };
  return { dir, items: parsed.items };
}

Then(
  'the backup {string} lists {string} as a {word}',
  function (this: unknown, stamp: string, orig: string, kind: string) {
    const world = as(this);
    const item = manifestOf(world, stamp).items.find((i) => i.original === world.at(orig));
    assert.ok(item, `the manifest of ${stamp} does not list ${orig}`);
    assert.equal(item.kind, kind);
  },
);

Then(
  'the backup {string} holds the copy {string} of {string} with the text {string}',
  function (this: unknown, stamp: string, copyOf: string, file: string, text: string) {
    const world = as(this);
    const { dir, items } = manifestOf(world, stamp);
    const owner = items.find((i) => world.at(file).startsWith(i.original) && i.original === world.at(copyOf));
    assert.ok(owner, `the manifest of ${stamp} does not list ${copyOf}`);
    const inside = path.relative(world.at(copyOf), world.at(file));
    const copy = inside === '' ? path.join(dir, owner.backup) : path.join(dir, owner.backup, inside);
    assert.equal(fs.readFileSync(copy, 'utf8').trimEnd(), text);
  },
);

Given('the file {string} is remembered', function (this: unknown, file: string) {
  const world = as(this);
  ((world.remembered ??= {}).files ??= new Map()).set(file, sha(world.at(file)));
});

Then('the backup {string} holds the remembered file {string}', function (this: unknown, stamp: string, file: string) {
  const world = as(this);
  const want = world.remembered?.files?.get(file);
  assert.ok(want, `"${file}" was not remembered`);
  const { dir, items } = manifestOf(world, stamp);
  const item = items.find((i) => i.original === world.at(file));
  assert.ok(item, `the manifest of ${stamp} does not list ${file}`);
  assert.equal(sha(path.join(dir, item.backup)), want);
  assert.equal(item.hash, want);
});

Then(
  'the remembered plan lists the links and generated files changed since the snapshot of {string}',
  function (this: unknown, dir: string) {
    const world = as(this);
    const plan = JSON.parse((world.remembered?.report ?? '').replaceAll('{root}', world.root)) as {
      changes: { path: string }[];
    };
    const planned = plan.changes.map((c) => path.relative(world.at(dir), c.path).split(path.sep).join('/')).sort();
    const before = world.snapshots?.get(dir);
    assert.ok(before, `no snapshot of "${dir}" was taken`);
    const after = snapshotTree(world.at(dir));
    const stateFiles = new Set([
      'install-state.json',
      'components.lock',
      'install.lock',
      'install-log.jsonl',
      'install-state.pending.json',
    ]);
    const changed = diffTrees(before, after)
      .map((line) => line.replace(/^(added|changed|removed) /, ''))
      .filter((p) => after.get(p) !== 'dir' && before.get(p) !== 'dir')
      .filter((p) => !p.includes('/store/') && !p.startsWith('store/') && !stateFiles.has(path.basename(p)))
      .filter((p) => !p.startsWith('.agent-config-backups/') && !p.includes('/components/'))
      .sort();
    assert.deepEqual(planned, changed);
  },
);

Given('the safety file {string} is written with {string}', function (this: unknown, file: string, text: string) {
  const world = as(this);
  fs.mkdirSync(path.dirname(world.at(file)), { recursive: true });
  fs.writeFileSync(world.at(file), text.replace(/\\n/g, '\n').replaceAll('{root}', world.root) + '\n');
});

Given('the safety file {string} gets the extra line {string}', function (this: unknown, file: string, line: string) {
  const world = as(this);
  fs.mkdirSync(path.dirname(world.at(file)), { recursive: true });
  fs.appendFileSync(world.at(file), line + '\n');
});

Then('the mtime of {string} is still 2001', function (this: unknown, file: string) {
  assert.equal(fs.lstatSync(as(this).at(file)).mtime.getUTCFullYear(), 2001);
});
