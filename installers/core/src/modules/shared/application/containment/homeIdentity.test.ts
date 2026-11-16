// M-03: file identity, with a table double where two paths can reach one folder.
import { describe, expect, it } from 'vitest';
import { checkHoldsNoProtectedFolder, checkHomeIdentity } from '#shared/application/containment/homeIdentity.ts';
import type { IdentityAnswer, PathProbe } from '#shared/application/containment/PathProbe.ts';

const id = (ino: number): IdentityAnswer => ({ kind: 'identity', dev: 1n, ino: BigInt(ino) });
// /Users/v is folder 3, /Users is 2, / is 1; the firmlink path reaches folders 3, 2 and 1 too.
const table: Record<string, IdentityAnswer> = {
  '/': id(1),
  '/Users': id(2),
  '/Users/v': id(3),
  '/System/Volumes/Data': id(1),
  '/System/Volumes/Data/Users': id(2),
  '/System/Volumes/Data/Users/v': id(3),
  '/Users/v/.agent-config': { kind: 'missing' },
  // /System/Volumes/Data is folder 8 (no folder of the chain), yet holds the home through the firmlink.
  '/Vol/Data': id(8),
  '/Vol/Data/Users': id(2),
  '/Vol/Data/Users/v': id(3),
  '/Vol/Other': id(9),
  '/Users/v/real': id(4),
  '/data/ac': id(5),
  '/locked': { kind: 'unknown' },
};
const probeOf = (answers: Record<string, IdentityAnswer>): PathProbe => ({
  realPath: (target) => ({ kind: 'real', path: target }),
  isLink: () => 'not-link',
  identity: (target) => answers[target] ?? { kind: 'missing' },
});
const check = (candidate: string, answers = table) =>
  checkHomeIdentity(candidate, '/Users/v', 'posix', probeOf(answers));

describe('M-03 the agent home by file identity', () => {
  it.each([
    ['a firmlink-style second path to the user home', '/System/Volumes/Data/Users/v'],
    ['a second path to a folder that holds the user home', '/System/Volumes/Data/Users'],
    ['a second path to the root', '/System/Volumes/Data'],
    ['the user home itself', '/Users/v'],
    ['a holder folder', '/Users'],
    ['the root', '/'],
    ['a holder whose own identity matches nothing but which holds the home through a firmlink', '/Vol/Data'],
    ['a folder that cannot be identified', '/locked'],
  ])('refuses %s', (_title, candidate) => {
    expect(check(candidate).ok).toBe(false);
  });

  it.each([
    ['a home that does not exist yet', '/Users/v/.agent-config'],
    ['a folder inside the user home', '/Users/v/real'],
    ['a folder elsewhere', '/data/ac'],
    ['a folder that holds nothing of the home', '/Vol/Other'],
  ])('accepts %s', (_title, candidate) => {
    expect(check(candidate)).toEqual({ ok: true, value: 'ok' });
  });

  it('refuses when the user home cannot be identified', () => {
    expect(check('/data/ac', { ...table, '/Users/v': { kind: 'unknown' } }).ok).toBe(false);
  });

  it('refuses when a folder above the user home cannot be identified', () => {
    expect(check('/data/ac', { ...table, '/Users': { kind: 'unknown' } }).ok).toBe(false);
  });

  it('refuses when the user home is missing', () => {
    expect(check('/data/ac', { ...table, '/Users/v': { kind: 'missing' } }).ok).toBe(false);
  });

  it('the same inode on another device is another folder', () => {
    const other = { ...table, '/data/ac': { kind: 'identity', dev: 9n, ino: 3n } as IdentityAnswer };
    expect(check('/data/ac', other).ok).toBe(true);
  });
});

describe('M-03 a candidate that holds a protected folder', () => {
  const home = { kind: 'identity', dev: 1n, ino: 3n } as const;
  const hold = (candidate: string, answers = table) =>
    checkHoldsNoProtectedFolder(candidate, '/Users/v', home, 'posix', probeOf(answers));

  it('refuses a firmlink-style holder', () => {
    expect(hold('/Vol/Data').ok).toBe(false);
  });

  it('accepts a folder that holds nothing', () => {
    expect(hold('/Vol/Other')).toEqual({ ok: true, value: 'clear' });
  });

  it('refuses when a joined path cannot be identified', () => {
    expect(hold('/Vol/Other', { ...table, '/Vol/Other/v': { kind: 'unknown' } }).ok).toBe(false);
  });

  it('finds the home at a shorter join (one segment)', () => {
    expect(hold('/Vol/Short', { ...table, '/Vol/Short/v': id(3) }).ok).toBe(false);
  });
});
