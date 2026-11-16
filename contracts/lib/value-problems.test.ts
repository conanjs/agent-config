// M-03 and DR-610: the Windows device names that an id or a path segment may not be. Table-driven; the schemas agree through the
// examples named windows-device-* in each contract (parity.test.ts).
import { describe, expect, it } from 'vitest';
import { idProblem, relativePathProblem } from './value-problems.ts';

describe('DR-610 ids that name a Windows device', () => {
  it.each(['con', 'prn', 'aux', 'nul', 'com0', 'com1', 'com9', 'lpt0', 'lpt9'])('refuses %s', (id) => {
    expect(idProblem(id)).toMatch(/Windows reserves/);
  });

  it.each(['conx', 'com', 'com10', 'lpt', 'my-con', 'con-1', 'nulls', 'aux2', 'cons'])('accepts %s', (id) => {
    expect(idProblem(id)).toBeUndefined();
  });
});

describe('DR-610 path segments that name a Windows device', () => {
  it.each([
    'con',
    'CON',
    'Con.txt',
    'a/nul',
    'a/NUL.md',
    'a/b/aux.tar.gz',
    'prn.x',
    'conin$',
    'CONOUT$',
    'clock$',
    'com1',
    'COM9.txt',
    'lpt3',
    'com¹',
    'LPT².log',
    'com³.x',
    'con .txt',
    './con',
    'a/con/b',
    'docs/NUL.txt',
  ])('refuses %j', (value) => {
    expect(relativePathProblem(value)).toMatch(/Windows reserves/);
  });

  it.each([
    'conx',
    'a/console.md',
    'com10',
    'com',
    'lpt',
    'a/b.con',
    'my.nul',
    'a/aux-notes.md',
    'clock',
    'conin',
    'x/com1x',
    'index.md',
  ])('accepts %j', (value) => {
    expect(relativePathProblem(value)).toBeUndefined();
  });
});
