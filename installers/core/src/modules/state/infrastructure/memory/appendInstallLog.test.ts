// M-16, EDGE-2: one line per run, rotated at 1 MiB, owner-only, never written through a link.
import { describe, expect, it } from 'vitest';
import { appendInstallLog } from '#state/application/log/appendInstallLog.ts';
import type { StateLogEntry } from '#state/application/StateTypes.ts';
import { createMemoryState } from '#state/infrastructure/memory/MemoryState.ts';

const entry: StateLogEntry = {
  time: '2026-11-20T09:14:03.000Z',
  command: 'install',
  exit: 0,
  components: [],
  approved_privileged: [],
};
const log = '/h/.agent-config/install-log.jsonl';

describe('M-16 the install log', () => {
  it('appends one owner-only line per run, even when nothing changed', () => {
    const machine = createMemoryState();
    appendInstallLog(machine.ports, entry);
    appendInstallLog(machine.ports, entry);
    const text = machine.ports.fs.readFile(log as never);
    expect(text.split('\n').filter((line) => line !== '')).toHaveLength(2);
    expect(machine.disk.listing().find((line) => line.startsWith(log))).toContain('file 600');
  });

  it('rotates a log of 1 MiB to install-log.jsonl.1, replacing the previous one, and starts a fresh log', () => {
    const machine = createMemoryState();
    machine.disk.seedFile(`${log}.1`, '{"marker":"older than the previous file"}\n');
    machine.disk.seedFile(log, `{"marker":"the file that will rotate"}\n${'x'.repeat(1_048_576)}\n`);
    expect(appendInstallLog(machine.ports, entry)).toEqual({ ok: true, value: 'rotated-and-appended' });
    expect(machine.ports.fs.readFile(`${log}.1` as never)).toContain('the file that will rotate');
    expect(machine.ports.fs.readFile(`${log}.1` as never)).not.toContain('older than the previous file');
    expect(
      machine.ports.fs
        .readFile(log as never)
        .split('\n')
        .filter((line) => line !== ''),
    ).toHaveLength(1);
  });

  it('does not rotate a log just under 1 MiB', () => {
    const machine = createMemoryState();
    machine.disk.seedFile(log, 'x'.repeat(1_048_575));
    expect(appendInstallLog(machine.ports, entry)).toEqual({ ok: true, value: 'appended' });
  });

  it('M-04 refuses a log that is a link, and writes nothing through it', () => {
    const machine = createMemoryState();
    machine.disk.seedFile('/h/other.txt', 'precious');
    machine.disk.seedLink(log, '/h/other.txt');
    expect(appendInstallLog(machine.ports, entry).ok).toBe(false);
    expect(machine.disk.listing()).toContain('/h/other.txt file 644 "precious"');
  });

  it('refuses a log that is a folder', () => {
    const machine = createMemoryState();
    machine.disk.seedFolder(log);
    expect(appendInstallLog(machine.ports, entry).ok).toBe(false);
  });
});
