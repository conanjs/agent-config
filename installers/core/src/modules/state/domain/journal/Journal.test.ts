// DR-202, EDGE-4: the journal text, the restore decision for each operation and each thing a kill can leave, and the committed check.
import { describe, expect, it } from 'vitest';
import {
  decideRestore,
  emitJournal,
  isCommitted,
  parseJournal,
  type Journal,
  type JournalOperation,
  type Observed,
  type RestoreStep,
} from '#state/domain/journal/Journal.ts';

const hash = 'b'.repeat(64);
const other = 'c'.repeat(64);
const journal: Journal = {
  home: '/h/.agent-config',
  command: 'install',
  started: '2026-11-20T09:14:03.000Z',
  operations: [
    {
      op: 'link',
      path: '/h/.agent-config/core',
      kind: 'symlink',
      target: '/h/.agent-config/store/core@0123456789ab',
      old: { state: 'absent' },
    },
    { op: 'write', path: '/h/.agent-config/generated/index.md', hash, old: { state: 'absent' } },
  ],
};

describe('the text of the journal', () => {
  it('reads back what it wrote', () => {
    expect(parseJournal(emitJournal(journal))).toEqual({ ok: true, value: journal });
  });

  it.each([
    ['empty', ''],
    ['truncated', emitJournal(journal).slice(0, 60)],
    ['an array', '[]'],
    ['another schema', emitJournal(journal).replace('install-journal/v1', 'install-journal/v9')],
    ['no home', JSON.stringify({ schema: 'install-journal/v1', command: 'install', started: 'x', operations: [] })],
    [
      'operations that are not a list',
      JSON.stringify({ schema: 'install-journal/v1', home: 'h', command: 'c', started: 's', operations: {} }),
    ],
    [
      'an unknown operation',
      JSON.stringify({
        schema: 'install-journal/v1',
        home: 'h',
        command: 'c',
        started: 's',
        operations: [{ op: 'format', path: '/x' }],
      }),
    ],
    [
      'a link with no target',
      JSON.stringify({
        schema: 'install-journal/v1',
        home: 'h',
        command: 'c',
        started: 's',
        operations: [{ op: 'link', path: '/x', kind: 'symlink', old: { state: 'absent' } }],
      }),
    ],
    [
      'a link of an unknown kind',
      JSON.stringify({
        schema: 'install-journal/v1',
        home: 'h',
        command: 'c',
        started: 's',
        operations: [{ op: 'link', path: '/x', kind: 'copy', target: '/y', old: { state: 'absent' } }],
      }),
    ],
    [
      'a write with a short hash',
      JSON.stringify({
        schema: 'install-journal/v1',
        home: 'h',
        command: 'c',
        started: 's',
        operations: [{ op: 'write', path: '/x', hash: 'ab', old: { state: 'absent' } }],
      }),
    ],
    [
      'an old state that is not known',
      JSON.stringify({
        schema: 'install-journal/v1',
        home: 'h',
        command: 'c',
        started: 's',
        operations: [{ op: 'write', path: '/x', hash, old: { state: 'maybe' } }],
      }),
    ],
    [
      'an old backup with no path',
      JSON.stringify({
        schema: 'install-journal/v1',
        home: 'h',
        command: 'c',
        started: 's',
        operations: [{ op: 'write', path: '/x', hash, old: { state: 'file' } }],
      }),
    ],
  ])('refuses %s without quoting it', (_title, text) => {
    expect(parseJournal(text).ok).toBe(false);
  });
});

const target = '/h/.agent-config/store/core@0123456789ab';
const oldTarget = '/h/.agent-config/store/core@aaaaaaaaaaaa';
const linkOver = (old: Extract<JournalOperation, { op: 'link' }>['old']): JournalOperation => ({
  op: 'link',
  path: '/p',
  kind: 'symlink',
  target,
  old,
});
const ours: Observed = { kind: 'link', target };

describe('DR-202 restoring a link', () => {
  const absent = linkOver({ state: 'absent' });
  const aLink = linkOver({ state: 'link', target: oldTarget, kind: 'symlink' });
  const backedUp = linkOver({ state: 'backed-up', backup: '/b/1-p' });
  const cases: [string, JournalOperation, Observed, RestoreStep][] = [
    ['new link, nothing there now (killed before the switch)', absent, { kind: 'absent' }, { action: 'nothing' }],
    ['new link, our link there (killed after the switch)', absent, ours, { action: 'remove-link' }],
    [
      'new link, another link there',
      absent,
      { kind: 'link', target: '/elsewhere' },
      { action: 'leave', why: expect.any(String) as string },
    ],
    [
      'new link, a real folder there',
      absent,
      { kind: 'folder' },
      { action: 'leave', why: expect.any(String) as string },
    ],
    [
      'switched link, our link there (killed after the switch)',
      aLink,
      ours,
      { action: 'switch-back', target: oldTarget, kind: 'symlink' },
    ],
    [
      'switched link, the old link there (killed before the switch)',
      aLink,
      { kind: 'link', target: oldTarget },
      { action: 'nothing' },
    ],
    [
      'switched link, nothing there (killed between remove and create)',
      aLink,
      { kind: 'absent' },
      { action: 'create-old-link', target: oldTarget, kind: 'symlink' },
    ],
    [
      'switched link, a third link there',
      aLink,
      { kind: 'link', target: '/elsewhere' },
      { action: 'leave', why: expect.any(String) as string },
    ],
    [
      'replaced folder, our link there',
      backedUp,
      ours,
      { action: 'copy-back', backup: '/b/1-p', removeLinkFirst: true },
    ],
    [
      'replaced folder, nothing there (killed after the removal)',
      backedUp,
      { kind: 'absent' },
      { action: 'copy-back', backup: '/b/1-p', removeLinkFirst: false },
    ],
    [
      'replaced folder, the folder still there (killed before the removal)',
      backedUp,
      { kind: 'folder' },
      { action: 'nothing' },
    ],
    [
      'replaced folder, another link there',
      backedUp,
      { kind: 'link', target: '/elsewhere' },
      { action: 'leave', why: expect.any(String) as string },
    ],
  ];
  it.each(cases)('%s', (_title, operation, observed, step) => {
    expect(decideRestore(operation, observed)).toEqual(step);
  });
});

describe('DR-202 restoring a written file', () => {
  const fresh: JournalOperation = { op: 'write', path: '/f', hash, old: { state: 'absent' } };
  const replaced: JournalOperation = { op: 'write', path: '/f', hash, old: { state: 'file', backup: '/b/1-f' } };
  const cases: [string, JournalOperation, Observed, RestoreStep][] = [
    ['new file, nothing there', fresh, { kind: 'absent' }, { action: 'nothing' }],
    ['new file, our content there', fresh, { kind: 'file', hash }, { action: 'remove-file' }],
    [
      'new file, V edited it',
      fresh,
      { kind: 'file', hash: other },
      { action: 'leave', why: expect.any(String) as string },
    ],
    [
      'new file, a link there',
      fresh,
      { kind: 'link', target: '/x' },
      { action: 'leave', why: expect.any(String) as string },
    ],
    [
      'replaced file, our content there',
      replaced,
      { kind: 'file', hash },
      { action: 'restore-file', backup: '/b/1-f' },
    ],
    ['replaced file, nothing there', replaced, { kind: 'absent' }, { action: 'restore-file', backup: '/b/1-f' }],
    [
      'replaced file, V edited it',
      replaced,
      { kind: 'file', hash: other },
      { action: 'leave', why: expect.any(String) as string },
    ],
  ];
  it.each(cases)('%s', (_title, operation, observed, step) => {
    expect(decideRestore(operation, observed)).toEqual(step);
  });
});

describe('a journal of a run that had committed', () => {
  const entries = [
    { path: '/h/.agent-config/core', target: '/h/.agent-config/store/core@0123456789ab' },
    { path: '/h/.agent-config/generated/index.md', hash },
  ];
  it.each([
    ['every journaled path is in the state', journal, entries, true],
    [
      'a link has another target in the state',
      journal,
      [{ path: '/h/.agent-config/core', target: '/other' }, ...entries.slice(1)],
      false,
    ],
    [
      'a file has another hash in the state',
      journal,
      [...entries.slice(0, 1), { path: '/h/.agent-config/generated/index.md', hash: other }],
      false,
    ],
    ['a path is missing from the state', journal, entries.slice(0, 1), false],
    ['no state entries at all', journal, [], false],
    ['a journal with no operation', { ...journal, operations: [] }, [], true],
  ] as [string, Journal, { path: string; target?: string; hash?: string }[], boolean][])(
    '%s',
    (_title, subject, listed, expected) => {
      expect(isCommitted(subject, listed)).toBe(expected);
    },
  );
});
