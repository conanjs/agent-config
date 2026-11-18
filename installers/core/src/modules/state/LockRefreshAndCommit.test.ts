// M-12, EDGE-15: a run keeps its lock fresh and can tell when it lost it; DR-202: a journal that cannot be deleted after the commit
// does not undo the commit; the journal can name components.lock as a write by its hash.
import { describe, expect, it } from 'vitest';
import { sha256Hex } from '#shared/domain/hash/sha256Hex.ts';
import { composeState } from '#state/StateModule.ts';
import { createMemoryState } from '#state/infrastructure/memory/MemoryState.ts';

const lockPath = '/h/.agent-config/install.lock';

async function taken() {
  const machine = createMemoryState();
  const state = composeState(machine.ports);
  const handle = await state.acquireLock({ command: 'install', pid: 1, mode: 'try' });
  if (!handle.ok) throw new Error('the lock was free');
  return { machine, state, handle: handle.value };
}

describe('holding and refreshing the lock', () => {
  it('knows its own text, and moves the start to now by a rewrite', async () => {
    const { machine, state, handle } = await taken();
    expect(state.holdsLock(handle)).toBe(true);
    machine.clock.set('2026-11-20T09:20:00.000Z');
    const next = state.refreshLock(handle);
    expect(next?.text).toContain('2026-11-20T09:20:00.000Z');
    expect(next === undefined ? false : state.holdsLock(next)).toBe(true);
    expect(state.holdsLock(handle)).toBe(false);
    expect(state.releaseLock(next ?? handle)).toBe('removed');
  });

  it('loses the lock when another run took it over after it went stale, and then neither refreshes nor releases it', async () => {
    const { machine, state, handle } = await taken();
    machine.clock.set('2026-11-20T09:40:00.000Z');
    const other = await state.acquireLock({ command: 'install', pid: 2, mode: 'try' });
    expect(other.ok).toBe(true);
    expect(state.holdsLock(handle)).toBe(false);
    expect(state.refreshLock(handle)).toBeUndefined();
    expect(state.releaseLock(handle)).toBe('changed');
    expect(machine.disk.listing().some((line) => line.startsWith(lockPath))).toBe(true);
  });

  it('says it lost the lock when the file is gone', async () => {
    const { machine, state, handle } = await taken();
    machine.ports.lock.removeIfSame(handle.text);
    expect(state.holdsLock(handle)).toBe(false);
    expect(state.refreshLock(handle)).toBeUndefined();
  });
});

describe('the commit', () => {
  const run = {
    installer: { version: '0.2.0', commit: 'abc' },
    home: '/h/.agent-config',
    last_run: { time: '2026-11-20T09:14:03.000Z', command: 'install', exit: 0 },
    components: {},
    entries: [],
  };

  it('hashes the lock the way it is written', () => {
    const machine = createMemoryState();
    const state = composeState(machine.ports);
    const lock = { components: {} };
    expect(state.commit(lock, run)).toEqual({ ok: true, value: 'committed' });
    const text = machine.ports.fs.readFile('/h/.agent-config/components.lock' as never);
    expect(state.lockHash(lock)).toBe(sha256Hex(text));
  });

  it('counts as committed when the journal cannot be deleted afterwards', async () => {
    const machine = createMemoryState();
    const state = composeState(machine.ports);
    expect(
      state.writeJournal({ home: '/h/.agent-config', command: 'install', started: run.last_run.time, operations: [] })
        .ok,
    ).toBe(true);
    const failing = {
      ...machine.ports,
      fs: {
        ...machine.ports.fs,
        remove: () => {
          throw Object.assign(new Error('EBUSY'), { code: 'EBUSY' });
        },
      },
    };
    expect(composeState(failing).commit({ components: {} }, run)).toEqual({ ok: true, value: 'journal-kept' });
    expect(machine.ports.fs.exists('/h/.agent-config/install-state.json' as never)).toBe(true);
    expect(machine.ports.fs.exists('/h/.agent-config/install-state.pending.json' as never)).toBe(true);
  });
});
