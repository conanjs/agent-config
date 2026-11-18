// What a finished run records (data-model "InstallStateEntry", "LockEntry"): the state, the lock, the comparison that decides "no changes",
// and the log line. A frozen component keeps its record; a failed run never reaches these functions with a half-written state.
import { describe, expect, it } from 'vitest';
import type { StateInstallState } from '#state/application/StateTypes.ts';
import {
  buildInstallState,
  buildLock,
  buildLogEntry,
  sameLock,
  sameState,
  type RunRecord,
} from '#commands/application/install/StateRecords.ts';

const previous: StateInstallState = {
  installer: { version: '0.1.0', commit: 'old' },
  home: '/h/.agent-config',
  last_run: { time: '2026-01-01T00:00:00.000Z', command: 'install', exit: 0 },
  components: { frozen: 'live', kb: 'a'.repeat(40) },
  entries: [
    {
      path: '/h/.agent-config/frozen',
      class: 'linked',
      kind: 'symlink',
      component: 'frozen',
      privileged: false,
      target: '/src/frozen',
    },
  ],
};

function record(overrides: Partial<RunRecord> = {}): RunRecord {
  return {
    home: '/h/.agent-config',
    installer: { version: '0.2.0', commit: 'new' },
    time: '2026-11-20T09:14:03.000Z',
    components: [
      {
        name: 'kb',
        slot: 'knowledge-storage',
        manifest: {} as never,
        origin: 'git',
        sourceRoot: '/c/kb',
        contentRoot: '/s/kb@1',
        git: {
          kind: 'acquired',
          name: 'kb',
          url: 'https://x.invalid/kb.git',
          ref: 'main',
          commit: 'b'.repeat(40),
          tag: undefined,
          advancedFrom: 'a'.repeat(40),
          submodules: false,
        },
        storeId: '0123456789ab',
      },
    ],
    loaded: [
      {
        name: 'kb',
        manifest: {
          version: '1.0.0',
          slot: 'knowledge-storage',
          provides: { contracts: ['knowledge-provider/v1'] },
        } as never,
        sourceRoot: '/c/kb',
        entry: {
          name: 'kb',
          source: { type: 'git', url: 'https://x.invalid/kb.git', ref: 'main' },
          origin: 'public',
          replaced: undefined,
        },
        git: undefined,
      },
    ],
    plan: {
      folders: [],
      writes: [],
      links: [
        {
          path: '/h/.agent-config/knowledge',
          target: '/s/kb@1/knowledge',
          class: 'linked',
          component: 'kb',
          how: 'create',
          old: { state: 'absent' },
        },
      ],
      unlinks: [],
      compat: { operations: [], unchanged: [], skipped: [], ensureFolders: [] },
    },
    carried: [previous.entries[0] as never],
    placedKinds: new Map(),
    previous,
    frozen: ['frozen'],
    previousLock: {
      components: {
        frozen: { source: { type: 'path', path: '/src/frozen' }, resolved: { live: true, path: '/src/frozen' } },
      },
    },
    consent: { entries: [], hash: 'h', diff: { pending: [], removed: [] } },
    ...overrides,
  };
}

describe('the install state', () => {
  it('lists the placed links, keeps a frozen component and its commit, and records the run', () => {
    const state = buildInstallState(record(), { command: 'install', exit: 0 });
    expect(state.components).toEqual({ frozen: 'live', kb: 'b'.repeat(40) });
    expect(state.entries.map((entry) => entry.path).sort()).toEqual([
      '/h/.agent-config/frozen',
      '/h/.agent-config/knowledge',
    ]);
    expect(state.last_run).toEqual({ time: '2026-11-20T09:14:03.000Z', command: 'install', exit: 0 });
    expect(state.approved_privileged_hash).toBeUndefined();
  });

  it('records the kind a link became, such as a junction on Windows', () => {
    const state = buildInstallState(record({ placedKinds: new Map([['/h/.agent-config/knowledge', 'junction']]) }), {
      command: 'install',
      exit: 0,
    });
    expect(state.entries.find((entry) => entry.path.endsWith('knowledge'))?.kind).toBe('junction');
  });

  it('records each approval with its hash and the hash of the set', () => {
    const entry = {
      kind: 'hook' as const,
      key: 'hook:kb:guard',
      component: 'kb',
      commit: 'live',
      hash: 'c'.repeat(64),
      display: {} as never,
    };
    const state = buildInstallState(
      record({ consent: { entries: [entry], hash: 'd'.repeat(64), diff: { pending: [], removed: [] } } }),
      {
        command: 'install',
        exit: 0,
      },
    );
    expect(state.approved_privileged_hash).toBe('d'.repeat(64));
    expect(state.entries.find((each) => each.path === 'privileged:hook:kb:guard')).toMatchObject({
      privileged: true,
      hash: 'c'.repeat(64),
    });
  });
});

describe('the lock', () => {
  it('keeps the entry of a frozen component and locks the commit of an installed git component', () => {
    const lock = buildLock(record({ loaded: [{ ...record().loaded[0], git: undefined } as never] }));
    expect(Object.keys(lock.components).sort()).toEqual(['frozen', 'kb']);
    expect(lock.components['kb']).toMatchObject({
      source: { type: 'git', url: 'https://x.invalid/kb.git', ref: 'main' },
      resolved: { commit: 'b'.repeat(40) },
      store_id: '0123456789ab',
    });
  });

  it('compares locks by their components', () => {
    const lock = buildLock(record());
    expect(sameLock(lock, buildLock(record()))).toBe(true);
    expect(sameLock(undefined, lock)).toBe(false);
  });
});

describe('the comparison that decides "no changes" (AC-7.1)', () => {
  it('ignores the time of the last run and the order of the entries', () => {
    const state = buildInstallState(record(), { command: 'install', exit: 0 });
    const later = {
      ...state,
      last_run: { time: 'later', command: 'install', exit: 0 },
      entries: [...state.entries].reverse(),
    };
    expect(sameState(state, later)).toBe(true);
    expect(sameState(undefined, state)).toBe(false);
    expect(sameState(state, { ...state, home: '/other' })).toBe(false);
  });
});

describe('the log line (M-16)', () => {
  it('names the components whose commit changed and the approvals, and never a value', () => {
    const entry = buildLogEntry(record(), { command: 'install', exit: 0 }, ['hook:kb:guard']);
    expect(entry).toEqual({
      time: '2026-11-20T09:14:03.000Z',
      command: 'install',
      exit: 0,
      components: [
        { name: 'kb', source: 'https://x.invalid/kb.git', commit_before: 'a'.repeat(40), commit_after: 'b'.repeat(40) },
      ],
      approved_privileged: ['hook:kb:guard'],
    });
  });
});
