// AC-8.3, M-14, M-03: the retired list, and the decision for each path.
import { describe, expect, it } from 'vitest';
import { COPILOT_FOLDER } from '#wiring/domain/compat/CompatLinks.ts';
import { decideRetired, decodeRetiredList, MAX_RETIRED, type RetiredFacts } from '#wiring/domain/compat/RetiredList.ts';

const tilde = `~/${COPILOT_FOLDER}`;
const patterns = `/h/${COPILOT_FOLDER}/patterns`;
const ownTarget = '/h/.agent-config/patterns';

describe('AC-8.3 reading compat.yaml', () => {
  it('reads the list of the scenario', () => {
    expect(decodeRetiredList({ schema: 'compat-links/v1', retired: [`${tilde}/patterns`] }, '/h', 'posix')).toEqual({
      ok: true,
      value: [{ written: `${tilde}/patterns`, path: patterns }],
    });
  });

  it.each([
    ['no file', undefined],
    ['an empty file', null],
    ['no retired key', { schema: 'compat-links/v1' }],
    ['an empty list', { schema: 'compat-links/v1', retired: [] }],
  ])('%s retires nothing', (_title, parsed) => {
    expect(decodeRetiredList(parsed, '/h', 'posix')).toEqual({ ok: true, value: [] });
  });

  it.each([
    ['another schema', { schema: 'compat-links/v2', retired: [] }],
    ['no schema', { retired: [] }],
    ['a list at the top', ['x']],
    ['a text at the top', 'x'],
    ['retired that is not a list', { schema: 'compat-links/v1', retired: 'x' }],
    [
      'more than 64 entries',
      {
        schema: 'compat-links/v1',
        retired: Array.from({ length: MAX_RETIRED + 1 }, (_unused, index) => `~/a${index}`),
      },
    ],
    ['an entry that is not text', { schema: 'compat-links/v1', retired: [1] }],
    ['an absolute path', { schema: 'compat-links/v1', retired: ['/etc/passwd'] }],
    ['a path not below the home', { schema: 'compat-links/v1', retired: ['~/../etc'] }],
    ['a parent segment inside', { schema: 'compat-links/v1', retired: [`${tilde}/../.ssh/id_rsa`] }],
    ['a backslash', { schema: 'compat-links/v1', retired: ['~/a\\b'] }],
    ['a NUL', { schema: 'compat-links/v1', retired: ['~/a\0b'] }],
    ['the home itself', { schema: 'compat-links/v1', retired: ['~/'] }],
    ['a device name on Windows', { schema: 'compat-links/v1', retired: ['~/con'] }],
  ])('refuses %s without repeating it', (_title, parsed) => {
    const result = decodeRetiredList(parsed, '/h', 'posix');
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain('passwd');
    expect(JSON.stringify(result)).not.toContain('id_rsa');
  });
});

const facts = (change: Partial<RetiredFacts>): RetiredFacts => ({
  observed: { kind: 'link', target: ownTarget },
  recorded: { path: patterns, target: ownTarget },
  usedByHook: false,
  hookFilesUnreadable: false,
  ...change,
});

describe('AC-8.3 and M-14 what happens to a retired path', () => {
  it.each([
    ['the installer own link, unused, is removed', facts({}), { action: 'remove' }],
    ['nothing there is already gone', facts({ observed: { kind: 'absent' } }), { action: 'gone' }],
    ['a real file is left', facts({ observed: { kind: 'file' } }), { action: 'left', reason: 'not-own' }],
    ['a real folder is left', facts({ observed: { kind: 'folder' } }), { action: 'left', reason: 'not-own' }],
    [
      'a link to another target is left',
      facts({ observed: { kind: 'link', target: '/elsewhere' } }),
      { action: 'left', reason: 'not-own' },
    ],
    [
      'a link the installer never recorded is left',
      facts({ recorded: undefined }),
      { action: 'left', reason: 'not-own' },
    ],
    [
      'a record for another path does not make a link own',
      facts({ recorded: { path: '/other', target: ownTarget } }),
      { action: 'left', reason: 'not-own' },
    ],
    [
      'a record with another target does not make a link own',
      facts({ recorded: { path: patterns, target: '/old' } }),
      { action: 'left', reason: 'not-own' },
    ],
    [
      'a path that cannot be seen is left',
      facts({ observed: { kind: 'unknown' } }),
      { action: 'left', reason: 'not-own' },
    ],
    [
      'an own link that a hook command names is kept',
      facts({ usedByHook: true }),
      { action: 'kept', reason: 'hook-command' },
    ],
    [
      'an own link is kept when a hook file cannot be read',
      facts({ hookFilesUnreadable: true }),
      { action: 'kept', reason: 'hook-files-unreadable' },
    ],
    [
      'a foreign link a hook names is still left, not removed',
      facts({ observed: { kind: 'link', target: '/elsewhere' }, usedByHook: true }),
      { action: 'left', reason: 'not-own' },
    ],
  ])('%s', (_title, given, expected) => {
    expect(decideRetired(patterns, given)).toEqual({ path: patterns, ...expected });
  });
});
