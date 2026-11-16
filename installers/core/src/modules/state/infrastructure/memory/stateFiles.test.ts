// DR-202, DR-205, LK-4, M-04: the state files are written by a temporary file and a rename, read back checked, and never written through a link.
import { describe, expect, it } from 'vitest';
import { writeFileAtomically } from '#state/application/files/atomicFiles.ts';
import {
  readComponentsLock,
  readInstallState,
  readJournal,
  removeJournal,
  writeComponentsLock,
  writeInstallState,
  writeJournal,
} from '#state/application/files/stateFiles.ts';
import { createMemoryState } from '#state/infrastructure/memory/MemoryState.ts';
import type { StateComponentsLock, StateInstallState, StateJournal } from '#state/application/StateTypes.ts';

const lock: StateComponentsLock = {
  components: { kb: { source: { type: 'path', path: '/x' }, resolved: { live: true, path: '/x' } } },
};
const state: StateInstallState = {
  installer: { version: '0.2.0', commit: '825ea82' },
  home: '/h/.agent-config',
  last_run: { time: '2026-11-20T09:14:03.000Z', command: 'install', exit: 0 },
  components: { kb: 'live' },
  entries: [],
};
const journal: StateJournal = { home: '/h/.agent-config', command: 'install', started: 'now', operations: [] };

describe('LK-4 writing a state file', () => {
  it('writes through a temporary file that is renamed, owner-only, and leaves no temporary file', () => {
    const machine = createMemoryState();
    expect(writeComponentsLock(machine.ports, lock)).toEqual({ ok: true, value: 'written' });
    const names = machine.disk.listing().filter((line) => line.startsWith('/h/.agent-config/'));
    expect(names).toHaveLength(1);
    expect(names[0]).toContain('/h/.agent-config/components.lock file 600');
  });

  it('removes a temporary file that a killed run left, then writes', () => {
    const machine = createMemoryState();
    machine.disk.seedFile('/h/.agent-config/components.lock.tmp', 'half written');
    expect(writeComponentsLock(machine.ports, lock).ok).toBe(true);
    expect(machine.disk.listing().some((line) => line.includes('.tmp'))).toBe(false);
  });

  it('replaces the old file in one step', () => {
    const machine = createMemoryState();
    machine.disk.seedFile('/h/.agent-config/components.lock', 'old');
    expect(writeComponentsLock(machine.ports, lock).ok).toBe(true);
    expect(machine.ports.fs.readFile('/h/.agent-config/components.lock' as never)).toContain('components-lock/v1');
  });

  it('M-04 refuses a link at the target and writes nothing through it', () => {
    const machine = createMemoryState();
    machine.disk.seedFile('/h/target.txt', 'precious');
    machine.disk.seedLink('/h/.agent-config/install-state.json', '/h/target.txt');
    const result = writeInstallState(machine.ports, state);
    expect(result).toEqual({ ok: false, error: { kind: 'refused', refusal: { kind: 'is-link' } } });
    expect(machine.disk.listing()).toContain('/h/target.txt file 644 "precious"');
  });

  it('refuses a folder at the target', () => {
    const machine = createMemoryState();
    machine.disk.seedFolder('/h/.agent-config/components.lock');
    expect(writeComponentsLock(machine.ports, lock)).toEqual({
      ok: false,
      error: { kind: 'refused', refusal: { kind: 'not-a-file' } },
    });
  });

  it('M-03 refuses a path outside the home and the roots', () => {
    const machine = createMemoryState();
    const result = writeFileAtomically(machine.ports, '/etc/passwd', 'x');
    expect(result.ok === false && result.error.kind).toBe('outside');
  });

  it('M-03 refuses a path below a link that leaves the home', () => {
    const machine = createMemoryState();
    machine.disk.seedFolder('/outside');
    machine.disk.seedLink('/h/.agent-config/generated', '/outside');
    const result = writeFileAtomically(machine.ports, '/h/.agent-config/generated/x.md', 'x');
    expect(result.ok === false && result.error.kind).toBe('outside');
    expect(machine.disk.listing().filter((line) => line.startsWith('/outside/'))).toEqual([]);
  });
});

describe('reading the state files', () => {
  it('answers not present before the first run', () => {
    const machine = createMemoryState();
    expect(readComponentsLock(machine.ports)).toEqual({ ok: true, value: { present: false } });
    expect(readInstallState(machine.ports)).toEqual({ ok: true, value: { present: false } });
    expect(readJournal(machine.ports)).toEqual({ ok: true, value: { present: false } });
  });

  it('reads back what was written', () => {
    const machine = createMemoryState();
    writeComponentsLock(machine.ports, lock);
    writeInstallState(machine.ports, state);
    writeJournal(machine.ports, journal);
    expect(readComponentsLock(machine.ports)).toEqual({ ok: true, value: { present: true, value: lock } });
    expect(readInstallState(machine.ports)).toEqual({ ok: true, value: { present: true, value: state } });
    expect(readJournal(machine.ports)).toEqual({ ok: true, value: { present: true, value: journal } });
  });

  it.each([
    ['empty', ''],
    ['truncated', '{"schema":"install-state/v1","home":"/h'],
    ['not JSON', 'schema: install-state/v1'],
  ])('DR-205 a %s state file is corrupt, not a throw', (_title, text) => {
    const machine = createMemoryState();
    machine.disk.seedFile('/h/.agent-config/install-state.json', text);
    const result = readInstallState(machine.ports);
    expect(result.ok === false && result.error).toMatchObject({ kind: 'invalid', problem: { kind: 'corrupt' } });
  });

  it('DR-205 a state file of a newer major is refused as such', () => {
    const machine = createMemoryState();
    machine.disk.seedFile('/h/.agent-config/install-state.json', '{"schema":"install-state/v2"}');
    const result = readInstallState(machine.ports);
    expect(result.ok === false && result.error).toMatchObject({ kind: 'invalid', problem: { kind: 'newer-major' } });
  });

  it('M-04 a state file that is a link is refused, not read', () => {
    const machine = createMemoryState();
    machine.disk.seedFile('/h/other.json', '{}');
    machine.disk.seedLink('/h/.agent-config/components.lock', '/h/other.json');
    expect(readComponentsLock(machine.ports)).toEqual({
      ok: false,
      error: { kind: 'refused', refusal: { kind: 'is-link' } },
    });
  });

  it('deletes the journal, and says so when there is none', () => {
    const machine = createMemoryState();
    expect(removeJournal(machine.ports)).toEqual({ ok: true, value: 'absent' });
    writeJournal(machine.ports, journal);
    expect(removeJournal(machine.ports)).toEqual({ ok: true, value: 'removed' });
    expect(readJournal(machine.ports)).toEqual({ ok: true, value: { present: false } });
  });
});
