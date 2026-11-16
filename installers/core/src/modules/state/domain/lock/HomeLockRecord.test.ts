// M-12, MG-30: the lock file text, and when a lock that exists is stale. The clock of the scenarios is 2026-11-20T09:14:03Z.
import { describe, expect, it } from 'vitest';
import { assessLock, emitLockText, parseLockText } from '#state/domain/lock/HomeLockRecord.ts';

const now = new Date('2026-11-20T09:14:03.000Z');
const record = (started: string): string => emitLockText({ command: 'install', pid: 4242, started });

describe('M-12 the lock file text', () => {
  it('is one JSON line with sorted keys', () => {
    expect(emitLockText({ command: 'install', pid: 4242, started: '2026-11-20T09:14:03.000Z' })).toBe(
      '{"command":"install","pid":4242,"started":"2026-11-20T09:14:03.000Z"}\n',
    );
  });

  it('reads what it writes', () => {
    expect(parseLockText(record('2026-11-20T09:14:03.000Z'))).toEqual({
      command: 'install',
      pid: 4242,
      started: '2026-11-20T09:14:03.000Z',
    });
  });

  it.each([
    ['empty', ''],
    ['not JSON', 'x'],
    ['an array', '[]'],
    ['no pid', '{"command":"install","started":"2026-11-20T09:14:03.000Z"}'],
    ['a text pid', '{"command":"install","pid":"1","started":"2026-11-20T09:14:03.000Z"}'],
    ['a negative pid', '{"command":"install","pid":-1,"started":"2026-11-20T09:14:03.000Z"}'],
    ['a fractional pid', '{"command":"install","pid":1.5,"started":"2026-11-20T09:14:03.000Z"}'],
    ['an empty command', '{"command":"","pid":1,"started":"2026-11-20T09:14:03.000Z"}'],
    ['a long command', `{"command":"${'x'.repeat(65)}","pid":1,"started":"2026-11-20T09:14:03.000Z"}`],
    ['a date that is not one', '{"command":"install","pid":1,"started":"soon"}'],
    [
      'a text over 4 KiB',
      `{"command":"install","pid":1,"started":"2026-11-20T09:14:03.000Z","x":"${'y'.repeat(5000)}"}`,
    ],
  ])('refuses %s as a lock record', (_title, text) => {
    expect(parseLockText(text)).toBeUndefined();
  });
});

describe('M-12 when a lock is stale', () => {
  it.each([
    ['fresh', '2026-11-20T09:14:03.000Z', 'held'],
    ['9 minutes 59 seconds old (EDGE-15)', '2026-11-20T09:04:04.000Z', 'held'],
    ['exactly 10 minutes old', '2026-11-20T09:04:03.000Z', 'held'],
    ['10 minutes and a millisecond old', '2026-11-20T09:04:02.999Z', 'stale'],
    ['older than 10 minutes (EDGE-15)', '2026-11-20T08:50:00.000Z', 'stale'],
    ['an hour old (M-12)', '2026-11-20T08:00:00.000Z', 'stale'],
    ['5 minutes in the future', '2026-11-20T09:19:03.000Z', 'held'],
    ['a year in the future (a hostile date)', '2027-11-20T09:14:03.000Z', 'stale'],
  ])('a lock %s is %s', (_title, started, verdict) => {
    expect(assessLock(record(started), 0, now).verdict).toBe(verdict);
  });

  it('names the holder for MG-30', () => {
    expect(assessLock(record('2026-11-20T09:10:00.000Z'), 0, now).holder).toEqual({
      command: 'install',
      pid: 4242,
      started: '2026-11-20T09:10:00.000Z',
    });
  });

  it('judges a file that is not a lock record by its modification time and calls its holder unknown', () => {
    const fresh = assessLock('garbage', now.getTime() - 60_000, now);
    expect(fresh).toEqual({
      verdict: 'held',
      holder: { command: 'unknown', pid: 0, started: '2026-11-20T09:13:03.000Z' },
    });
    expect(assessLock('garbage', now.getTime() - 3_600_000, now).verdict).toBe('stale');
  });
});
