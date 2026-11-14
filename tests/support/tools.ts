// tools.ts — shared scenario support for the new tools of specs/022 (TypeScript, run by Node type stripping).
// It sits beside tools.mjs, whose registry it uses, and gives a tool's tool.ts four things:
//   1. a temporary home per scenario: `temporaryHome(world)` and the step "a temporary home exists";
//   2. a snapshot of a file tree before and after, for the "write nothing" scenarios: `snapshotTree`, `diffTrees`
//      and the steps "a snapshot of {string} is taken" and "since the snapshot, nothing under {string} changed";
//   3. an exact text compare that ignores timestamps: `normalizeTimestamps`, `compareExact` and the step
//      "the output equals, ignoring timestamps:";
//   4. a runner for the tools under contracts/ and scripts/: `scriptRunner(relativePath)` gives the `run` entry of
//      registerTool, so the shared steps "the tool runs with …" and "it exits with …" drive them.
// Every tool runs with HOME (and USERPROFILE, which os.homedir() reads on Windows) set to the scenario's temporary
// home, never the real one.

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Given, Then } from '@cucumber/cucumber';
import { repo } from './tools.mjs';

/** The parts of the scenario World that this file uses (the World itself is tests/support/world.mjs). */
export interface ToolWorld {
  root: string;
  at(p: string): string;
  result?: { code: number; out: string };
  snapshots?: Map<string, Snapshot>;
}

/** One line per entry of a tree, keyed by path relative to the tree: "dir", "link <target>" or "file <mode> <sha256>". */
export type Snapshot = ReadonlyMap<string, string>;

/** Creates `<root>/home` and returns its path. Idempotent. */
export function temporaryHome(world: Pick<ToolWorld, 'at'>): string {
  const home = world.at('home');
  fs.mkdirSync(home, { recursive: true });
  return home;
}

/** Records every entry under `dir` (links are not followed): kind, link target, file mode and content hash. */
export function snapshotTree(dir: string): Snapshot {
  const entries = new Map<string, string>();
  const walk = (current: string): void => {
    for (const name of fs.readdirSync(current).sort()) {
      const full = path.join(current, name);
      const key = path.relative(dir, full).split(path.sep).join('/');
      const stat = fs.lstatSync(full);
      if (stat.isSymbolicLink()) {
        entries.set(key, `link ${fs.readlinkSync(full)}`);
      } else if (stat.isDirectory()) {
        entries.set(key, 'dir');
        walk(full);
      } else {
        // File modes mean nothing on Windows (every file reads as 666), so they are left out there.
        const mode = process.platform === 'win32' ? '-' : (stat.mode & 0o777).toString(8);
        entries.set(key, `file ${mode} ${createHash('sha256').update(fs.readFileSync(full)).digest('hex')}`);
      }
    }
  };
  walk(dir);
  return entries;
}

/** The changes from `before` to `after`, one line each, sorted: "added <path>", "changed <path>", "removed <path>". */
export function diffTrees(before: Snapshot, after: Snapshot): string[] {
  const changes: string[] = [];
  for (const [key, value] of after) {
    if (!before.has(key)) changes.push(`added ${key}`);
    else if (before.get(key) !== value) changes.push(`changed ${key}`);
  }
  for (const key of before.keys()) if (!after.has(key)) changes.push(`removed ${key}`);
  return changes.sort();
}

/** Replaces a 14-digit backup stamp (YYYYMMDDHHMMSS) and an ISO 8601 date-time with `<timestamp>`; line ends become \n. */
export function normalizeTimestamps(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?/g, '<timestamp>')
    .replace(/(?<!\d)\d{14}(?!\d)/g, '<timestamp>');
}

/** Exact compare after normalizing both sides and trimming trailing whitespace; returns null when equal, else a readable difference. */
export function compareExact(actual: string, expected: string): string | null {
  const a = normalizeTimestamps(actual).trimEnd();
  const e = normalizeTimestamps(expected).trimEnd();
  return a === e ? null : `--- actual ---\n${a}\n--- expected ---\n${e}\n--- end ---`;
}

/**
 * The `run` entry of registerTool for a tool file under contracts/ or scripts/ (or, with `inFixture`, under the
 * scenario's temp folder): `.ts` and `.mjs` run with the current Node, `.sh` with bash. HOME and USERPROFILE are the scenario's temporary home.
 */
export function scriptRunner(relativePath: string, options: { inFixture?: boolean } = {}) {
  return (world: ToolWorld, extraArgs: string[]): { file: string; args: string[]; env: Record<string, string> } => {
    const script = options.inFixture ? world.at(relativePath) : path.join(repo, relativePath);
    const bash = path.extname(script) === '.sh';
    return {
      file: bash ? 'bash' : process.execPath,
      args: [script, ...extraArgs],
      env: { HOME: temporaryHome(world), USERPROFILE: temporaryHome(world) },
    };
  };
}

// ---- Steps -----------------------------------------------------------------------------------------

Given('a temporary home exists', function (this: unknown) {
  temporaryHome(this as ToolWorld);
});

Given('a snapshot of {string} is taken', function (this: unknown, dir: string) {
  const world = this as ToolWorld;
  (world.snapshots ??= new Map()).set(dir, snapshotTree(world.at(dir)));
});

function changesSince(world: ToolWorld, dir: string): string[] {
  const before = world.snapshots?.get(dir);
  assert.ok(before, `no snapshot of "${dir}" was taken`);
  return diffTrees(before, snapshotTree(world.at(dir)));
}

Then('since the snapshot, nothing under {string} changed', function (this: unknown, dir: string) {
  assert.deepEqual(changesSince(this as ToolWorld, dir), []);
});

Then('since the snapshot, {string} has these changes:', function (this: unknown, dir: string, doc: string) {
  assert.deepEqual(
    changesSince(this as ToolWorld, dir),
    doc
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .sort(),
  );
});

function outputOf(world: ToolWorld): string {
  assert.ok(world.result, 'the tool has not run');
  return world.result.out;
}

Then('the output equals, ignoring timestamps:', function (this: unknown, doc: string) {
  const diff = compareExact(outputOf(this as ToolWorld), doc);
  assert.equal(diff, null, diff ?? '');
});

Then('the output differs from this, ignoring timestamps:', function (this: unknown, doc: string) {
  assert.notEqual(compareExact(outputOf(this as ToolWorld), doc), null, 'the texts are equal');
});
