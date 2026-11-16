// M-12, MG-30, EDGE-15: one writer at a time. Fresh and stale locks, the 2-second wait, rerender trying once, and a lock file that is a link.
import { describe, expect, it } from 'vitest';
import { acquireHomeLock, releaseHomeLock, WAIT_ATTEMPTS, WAIT_STEP_MS } from '#state/application/lock/homeLock.ts';
import { createMemoryState } from '#state/infrastructure/memory/MemoryState.ts';

const lockPath = '/h/.agent-config/install.lock';
const held = (started: string, command = 'install'): string =>
  `{"command":"${command}","pid":4242,"started":"${started}"}\n`;
const install = { command: 'install', pid: 1, mode: 'wait' } as const;

function setup(existing?: string) {
  const machine = createMemoryState();
  if (existing !== undefined) machine.disk.seedFile(lockPath, existing);
  return { machine, deps: { lock: machine.ports.lock, clock: machine.clock } };
}

describe('M-12 taking the lock', () => {
  it('creates the lock file with the command, the pid and the clock', async () => {
    const { machine, deps } = setup();
    const result = await acquireHomeLock(deps, install);
    expect(result.ok && result.value.text).toBe('{"command":"install","pid":1,"started":"2026-11-20T09:14:03.000Z"}\n');
    expect(machine.ports.lock.read()).toMatchObject({ kind: 'file', text: result.ok ? result.value.text : '' });
  });

  it('EDGE-15 a fresh lock held by another run is refused naming the holder, after waiting 2 seconds', async () => {
    const { machine, deps } = setup(held('2026-11-20T09:14:03.000Z'));
    const result = await acquireHomeLock(deps, install);
    expect(result).toEqual({
      ok: false,
      error: {
        kind: 'held',
        path: lockPath,
        holder: { command: 'install', pid: 4242, started: '2026-11-20T09:14:03.000Z' },
      },
    });
    expect(machine.clock.sleeps).toEqual(Array.from({ length: WAIT_ATTEMPTS - 1 }, () => WAIT_STEP_MS));
    expect(machine.clock.sleeps.reduce((sum, step) => sum + step, 0)).toBeLessThanOrEqual(2000);
  });

  it('EDGE-15 a lock 9 minutes 59 seconds old still holds', async () => {
    const { deps } = setup(held('2026-11-20T09:04:04.000Z'));
    expect((await acquireHomeLock(deps, install)).ok).toBe(false);
  });

  it('EDGE-15 a lock older than 10 minutes is taken over, the file now names this run', async () => {
    const { machine, deps } = setup(held('2026-11-20T08:50:00.000Z'));
    const result = await acquireHomeLock(deps, install);
    expect(result.ok).toBe(true);
    expect(machine.clock.sleeps).toEqual([]);
    expect(machine.ports.lock.read()).toMatchObject({
      kind: 'file',
      text: expect.stringContaining('"pid":1') as string,
    });
  });

  it('M-12 rerender only tries: no wait, no sleep, held is the answer', async () => {
    const { machine, deps } = setup(held('2026-11-20T09:10:00.000Z'));
    const result = await acquireHomeLock(deps, { command: 'rerender', pid: 1, mode: 'try' });
    expect(result.ok === false && result.error.kind).toBe('held');
    expect(machine.clock.sleeps).toEqual([]);
  });

  it('a lock that is freed while waiting is taken', async () => {
    const { machine, deps } = setup(held('2026-11-20T09:14:03.000Z'));
    let looks = 0;
    deps.clock.sleep = () => {
      looks += 1;
      if (looks === 3) machine.ports.lock.removeIfSame(held('2026-11-20T09:14:03.000Z'));
      return Promise.resolve();
    };
    expect((await acquireHomeLock(deps, install)).ok).toBe(true);
    expect(looks).toBe(3);
  });

  it('M-12 a lock file that is not a lock record is held until it is 10 minutes old', async () => {
    const { machine, deps } = setup('garbage');
    machine.disk.setTime(machine.clock.now().getTime() - 60_000);
    machine.disk.seedFile(lockPath, 'garbage');
    expect((await acquireHomeLock(deps, { ...install, mode: 'try' })).ok).toBe(false);
    machine.disk.seedFile(lockPath, 'garbage');
    machine.clock.set('2026-11-20T10:30:00.000Z');
    expect((await acquireHomeLock(deps, install)).ok).toBe(true);
  });

  it('M-04 a lock file that is a link is refused, never followed or replaced', async () => {
    const machine = createMemoryState();
    machine.disk.seedFile('/h/elsewhere.txt', 'precious');
    machine.disk.seedLink(lockPath, '/h/elsewhere.txt');
    const result = await acquireHomeLock({ lock: machine.ports.lock, clock: machine.clock }, install);
    expect(result).toEqual({ ok: false, error: { kind: 'unusable', path: lockPath, why: 'is-link' } });
    expect(machine.disk.listing()).toContain('/h/elsewhere.txt file 644 "precious"');
  });

  it('a lock file that is a folder is refused as unreadable', async () => {
    const machine = createMemoryState();
    machine.disk.seedFolder(lockPath);
    const result = await acquireHomeLock({ lock: machine.ports.lock, clock: machine.clock }, install);
    expect(result.ok === false && result.error).toMatchObject({ kind: 'unusable', why: 'unreadable' });
  });
});

describe('M-12 releasing the lock', () => {
  it('removes the lock this run took', async () => {
    const { machine, deps } = setup();
    const taken = await acquireHomeLock(deps, install);
    expect(taken.ok && releaseHomeLock(deps, taken.value)).toBe('removed');
    expect(machine.ports.lock.read()).toEqual({ kind: 'absent' });
  });

  it('leaves a lock another run took after this one went stale', async () => {
    const { machine, deps } = setup();
    const taken = await acquireHomeLock(deps, install);
    machine.ports.lock.removeIfSame(taken.ok ? taken.value.text : '');
    machine.disk.seedFile(lockPath, held('2026-11-20T09:20:00.000Z', 'uninstall'));
    expect(taken.ok && releaseHomeLock(deps, taken.value)).toBe('changed');
    expect(machine.ports.lock.read()).toMatchObject({ kind: 'file' });
  });

  it('answers absent when the lock is already gone', async () => {
    const { machine, deps } = setup();
    const taken = await acquireHomeLock(deps, install);
    machine.ports.lock.removeIfSame(taken.ok ? taken.value.text : '');
    expect(taken.ok && releaseHomeLock(deps, taken.value)).toBe('absent');
  });
});
