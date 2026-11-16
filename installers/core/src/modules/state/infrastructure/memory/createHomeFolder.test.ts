// M-03, M-10: the home is created one level at a time and checked by identity again before the first write.
import { describe, expect, it } from 'vitest';
import { createHomeFolder } from '#state/application/home/createHomeFolder.ts';
import { createMemoryState } from '#state/infrastructure/memory/MemoryState.ts';

describe('M-10 creating the home', () => {
  it('creates a missing home owner-only', () => {
    const machine = createMemoryState();
    const deps = { ...machine.ports, home: '/h/new-home' };
    expect(createHomeFolder(deps, '/h')).toEqual({ ok: true, value: 'created' });
    expect(machine.disk.listing()).toContain('/h/new-home folder 700');
  });

  it('creates every missing level, each owner-only', () => {
    const machine = createMemoryState();
    const deps = { ...machine.ports, home: '/h/data/ac' };
    expect(createHomeFolder(deps, '/h').ok).toBe(true);
    expect(machine.disk.listing().filter((line) => line.startsWith('/h/data'))).toEqual([
      '/h/data folder 700',
      '/h/data/ac folder 700',
    ]);
  });

  it('accepts a home that exists and changes nothing', () => {
    const machine = createMemoryState();
    const before = machine.disk.listing();
    expect(createHomeFolder(machine.ports, '/h')).toEqual({ ok: true, value: 'existed' });
    expect(machine.disk.listing()).toEqual(before);
  });
});

describe('M-03 the home is checked by identity after it exists', () => {
  it('refuses the user home itself', () => {
    const machine = createMemoryState();
    expect(createHomeFolder({ ...machine.ports, home: '/h' }, '/h').ok).toBe(false);
  });

  it('refuses a home that is a link to the user home (a second path to it)', () => {
    const machine = createMemoryState();
    machine.disk.seedLink('/data-home', '/h');
    expect(createHomeFolder({ ...machine.ports, home: '/data-home' }, '/h').ok).toBe(false);
  });

  it('refuses a folder that holds the user home through a link', () => {
    const machine = createMemoryState();
    machine.disk.seedFolder('/vol');
    machine.disk.seedLink('/vol/h', '/h');
    expect(createHomeFolder({ ...machine.ports, home: '/vol' }, '/h').ok).toBe(false);
  });
});
