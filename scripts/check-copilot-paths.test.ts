// Unit tests of the sorting check of the hard-coded Copilot home paths (specs/022 T149, AC-8.4). The scenarios of
// tests/installer-compat/sorting.feature drive the whole script; these pin the classifier table, the record reader and the report.
// The folder name is built, never written in full, so the check does not count this file.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  RECORD_FILE,
  buildReport,
  classifyFiles,
  classifyLine,
  readRecord,
  renderReport,
  run,
} from './check-copilot-paths.ts';

const H = ['~', '.copilot'].join('/');
const own = [`${H}/hooks`, `${H}/agents`, `${H}/config.json`];
const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

function tree(files: Record<string, string>): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'copilot-paths-'));
  roots.push(root);
  for (const [name, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
    fs.writeFileSync(path.join(root, name), text);
  }
  return root;
}

const record = (counts: string): string =>
  `schema: copilot-paths/v1\nmethod: m\ndate: 2026-11-16\nown:\n  - ${H}/hooks\nagent-home-lines:\n${counts}`;

describe('AC-8.4 the classifier table', () => {
  const table: [string, string, string | null][] = [
    ['an agent-home folder', `Read ${H}/knowledge/index.md first.`, 'agent-home'],
    ['an own folder', `Hooks live in ${H}/hooks/a.json`, 'copilot-own'],
    ['the own folder itself, with a full stop after it', `See ${H}/hooks.`, 'copilot-own'],
    ['an own file, exact', `Edit ${H}/config.json now`, 'copilot-own'],
    ['a longer name that starts like an own entry', `${H}/hooksx/a.md`, 'agent-home'],
    ['a file that starts like an own folder, with an extension', `${H}/hooks.md`, 'agent-home'],
    ['an own path and an agent-home path on one line', `${H}/hooks and ${H}/knowledge`, 'agent-home'],
    ['two own paths on one line', `${H}/hooks and ${H}/agents`, 'copilot-own'],
    ['the bare folder', `Copy it to ${H}/`, 'agent-home'],
    ['the placeholder and no home path', '{{AGENT_HOME}}/knowledge/index.md', null],
    ['a longer name of the folder itself', `${H}-extra/a.md and ${H}x`, null],
    ['a line with no path', 'Plain text', null],
    ['a path in a Windows form', '%USERPROFILE%\\.copilot\\knowledge', null],
  ];
  it.each(table)('%s', (_name, line, expected) => {
    expect(classifyLine(line, own)).toBe(expected);
  });

  it('an entry that does not start with the home folder never matches', () => {
    expect(classifyLine(`${H}/hooks`, ['hooks'])).toBe('agent-home');
  });
});

describe('AC-8.4 classifying files', () => {
  it('numbers lines from 1, sorts by file and line, and skips the record file', () => {
    const lines = classifyFiles(
      [
        { path: 'b.md', text: `x\r\n${H}/hooks` },
        { path: 'a.md', text: `${H}/k\n\n${H}/k2` },
        { path: RECORD_FILE, text: `${H}/k` },
      ],
      own,
    );
    expect(lines.map((l) => `${l.kind} ${l.file}:${l.line}`)).toEqual([
      'agent-home a.md:1',
      'agent-home a.md:3',
      'copilot-own b.md:2',
    ]);
  });
});

describe('AC-8.4 the report', () => {
  const lines = classifyFiles(
    [
      { path: 'a.md', text: `${H}/k1\n${H}/k2\n${H}/k3` },
      { path: 'b.md', text: `${H}/hooks` },
    ],
    own,
  );

  it('names the last lines of a file as new when its count is above the record', () => {
    const report = buildReport(lines, { own, agentHomeLines: { 'a.md': 1, 'gone.md': 2 } });
    expect(report.newLines.map((l) => `${l.file}:${l.line}`)).toEqual(['a.md:2', 'a.md:3']);
    expect(report.baseline).toBe(3);
    expect(report.files).toBe(2);
  });

  it('a count below the record passes', () => {
    expect(buildReport(lines, { own, agentHomeLines: { 'a.md': 9 } }).newLines).toEqual([]);
  });

  it('puts the new lines first, then the listing, then the totals, and says "files" for one file', () => {
    const report = buildReport(lines.slice(0, 1), { own, agentHomeLines: {} });
    expect(renderReport(report, true)).toEqual([
      `new agent-home line: a.md:1: ${H}/k1`,
      'agent-home a.md:1',
      'copilot paths: 1 lines in 1 files (agent-home 1, copilot-own 0), baseline agent-home 0',
    ]);
  });
});

describe('AC-8.4 the record file', () => {
  it('reads the allow-list and the counts', () => {
    const read = readRecord(record('  a.md: 2\n'));
    expect(read).toEqual({ ok: true, value: { own: [`${H}/hooks`], agentHomeLines: { 'a.md': 2 } } });
  });

  it.each([
    ['a wrong schema', 'schema: other/v1\n'],
    ['an own entry outside the home folder', record('  a.md: 1\n').replace(`${H}/hooks`, '/etc/hooks')],
    ['a count that is not a whole number', record('  a.md: many\n')],
    ['a negative count', record('  a.md: -1\n')],
  ])('rejects %s', (_name, text) => {
    expect(readRecord(text).ok).toBe(false);
  });
});

describe('AC-8.4 running on a folder', () => {
  it('passes at the baseline and lists the classes', () => {
    const root = tree({ [RECORD_FILE]: record('  a.md: 1\n'), 'a.md': `${H}/k`, 'b.md': `${H}/hooks/x` });
    expect(run(root, true)).toEqual({
      code: 0,
      lines: [
        'agent-home a.md:1',
        'copilot-own b.md:1',
        'copilot paths: 2 lines in 2 files (agent-home 1, copilot-own 1), baseline agent-home 1',
      ],
    });
  });

  it('fails on a new line in a new file', () => {
    const root = tree({ [RECORD_FILE]: record('  a.md: 0\n'), 'sub/n.md': `a\n${H}/k` });
    const outcome = run(root, false);
    expect(outcome.code).toBe(1);
    expect(outcome.lines[0]).toBe(`new agent-home line: sub/n.md:2: ${H}/k`);
  });

  it('skips node_modules and binary files', () => {
    const root = tree({
      [RECORD_FILE]: record('  a.md: 0\n'),
      'node_modules/x.md': `${H}/k`,
      'bin.dat': `\0${H}/k`,
    });
    expect(run(root, false).code).toBe(0);
  });

  it('fails and names a missing record file', () => {
    expect(run(tree({}), false)).toEqual({ code: 1, lines: [`error: ${RECORD_FILE} is missing`] });
  });

  it('fails and names an unusable record file', () => {
    const outcome = run(tree({ [RECORD_FILE]: 'schema: other/v1\n' }), false);
    expect(outcome.code).toBe(1);
    expect(outcome.lines[0]).toContain(RECORD_FILE);
  });
});
