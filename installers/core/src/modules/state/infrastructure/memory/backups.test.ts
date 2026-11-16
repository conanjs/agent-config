// AC-7.3, DR-203, M-10: a backup folder named by the clock, owner-only, with a manifest, made only when there is something to copy.
import { describe, expect, it } from 'vitest';
import { applyBackupModes } from '#state/application/backup/applyBackupModes.ts';
import { backupItems } from '#state/application/backup/backupItems.ts';
import { readNewestBackup } from '#state/application/backup/readNewestBackup.ts';
import { createMemoryState } from '#state/infrastructure/memory/MemoryState.ts';
import { sha256Hex } from '#shared/domain/hash/sha256Hex.ts';

function patterns() {
  const machine = createMemoryState();
  machine.disk.seedFile('/h/.copilot/patterns/mine.md', 'mine');
  machine.disk.seedFile('/h/.copilot/patterns/tools/run.sh', '#!/bin/sh');
  machine.ports.fs.setMode('/h/.copilot/patterns/tools/run.sh' as never, 0o755);
  return machine;
}

describe('AC-7.3 making a backup', () => {
  it('makes no folder when nothing exists to back up', () => {
    const machine = createMemoryState();
    expect(backupItems(machine.ports, ['/h/.copilot/patterns'])).toEqual({ ok: true, value: { kind: 'none' } });
    expect(machine.disk.listing().some((line) => line.includes('backups'))).toBe(false);
  });

  it('copies the folder under the name of the clock and lists it in a manifest', () => {
    const machine = patterns();
    const result = backupItems(machine.ports, ['/h/.copilot/patterns', '/h/.copilot/missing']);
    expect(result.ok && result.value.kind === 'made' && result.value.folder).toBe(
      '/h/.agent-config-backups/20261120091403',
    );
    expect(machine.ports.fs.readFile('/h/.agent-config-backups/20261120091403/1-patterns/mine.md' as never)).toBe(
      'mine',
    );
    const read = readNewestBackup(machine.ports);
    expect(
      read.ok &&
        read.value.kind === 'found' &&
        read.value.backup.manifest.items.map((item) => [item.original, item.backup, item.kind]),
    ).toEqual([['/h/.copilot/patterns', '1-patterns', 'folder']]);
  });

  it('M-10 makes the folder, the copies and the manifest owner-only', () => {
    const machine = patterns();
    backupItems(machine.ports, ['/h/.copilot/patterns']);
    const modes = machine.disk
      .listing()
      .filter((line) => line.includes('agent-config-backups'))
      .map((line) => line.split(' ').slice(0, 3).join(' '));
    expect(modes).toEqual([
      '/h/.agent-config-backups folder 700',
      '/h/.agent-config-backups/20261120091403 folder 700',
      '/h/.agent-config-backups/20261120091403/1-patterns folder 700',
      '/h/.agent-config-backups/20261120091403/1-patterns/mine.md file 600',
      '/h/.agent-config-backups/20261120091403/1-patterns/tools folder 700',
      '/h/.agent-config-backups/20261120091403/1-patterns/tools/run.sh file 600',
      '/h/.agent-config-backups/20261120091403/backup-manifest.json file 600',
    ]);
  });

  it('records the hash of a file as the SHA-256 of its content', () => {
    const machine = createMemoryState();
    machine.disk.seedFile('/h/.agent-config/variables.local.yaml', 'schema: variables-local/v1\n');
    const result = backupItems(machine.ports, ['/h/.agent-config/variables.local.yaml']);
    expect(result.ok && result.value.kind === 'made' && result.value.items[0]).toMatchObject({
      kind: 'file',
      hash: sha256Hex('schema: variables-local/v1\n'),
    });
  });

  it('copies a link as a link', () => {
    const machine = createMemoryState();
    machine.disk.seedLink('/h/.copilot/knowledge', '/h/.agent-config/knowledge');
    const result = backupItems(machine.ports, ['/h/.copilot/knowledge']);
    expect(result.ok && result.value.kind === 'made' && result.value.items[0]?.kind).toBe('link');
    expect(machine.ports.links.readLink('/h/.agent-config-backups/20261120091403/1-knowledge' as never)).toBe(
      '/h/.agent-config/knowledge',
    );
  });

  it('takes a .N suffix when two runs share a second', () => {
    const machine = patterns();
    backupItems(machine.ports, ['/h/.copilot/patterns']);
    const second = backupItems(machine.ports, ['/h/.copilot/patterns']);
    expect(second.ok && second.value.kind === 'made' && second.value.folder).toBe(
      '/h/.agent-config-backups/20261120091403.1',
    );
  });

  it('M-03 refuses an item outside the home and the agent folders', () => {
    const machine = createMemoryState();
    machine.disk.seedFile('/etc/hosts', 'x');
    expect(backupItems(machine.ports, ['/etc/hosts'])).toEqual({ ok: true, value: { kind: 'none' } });
  });
});

describe('DR-203 the newest backup', () => {
  it('is none before the first backup', () => {
    expect(readNewestBackup(createMemoryState().ports)).toEqual({ ok: true, value: { kind: 'none' } });
  });

  it('is the newest by time, and ignores a folder that is not named like a backup', () => {
    const machine = patterns();
    backupItems(machine.ports, ['/h/.copilot/patterns']);
    machine.clock.set('2026-11-21T09:00:00.000Z');
    backupItems(machine.ports, ['/h/.copilot/patterns']);
    machine.disk.seedFolder('/h/.agent-config-backups/zzz-notes');
    const read = readNewestBackup(machine.ports);
    expect(read.ok && read.value.kind === 'found' && read.value.backup.folder).toBe(
      '/h/.agent-config-backups/20261121090000',
    );
  });

  it('refuses a newest backup whose manifest is missing or damaged', () => {
    const machine = createMemoryState();
    machine.disk.seedFolder('/h/.agent-config-backups/20261120091403');
    expect(readNewestBackup(machine.ports).ok).toBe(false);
    machine.disk.seedFile('/h/.agent-config-backups/20261120091403/backup-manifest.json', '{');
    expect(readNewestBackup(machine.ports).ok).toBe(false);
  });
});

describe('AC-7.6 the permission bits of a restored backup', () => {
  it('puts the recorded bits back, so a script stays executable', () => {
    const machine = patterns();
    const result = backupItems(machine.ports, ['/h/.copilot/patterns']);
    if (!result.ok || result.value.kind !== 'made') throw new Error('backup expected');
    const copy = `${result.value.folder}/1-patterns`;
    machine.ports.fs.remove('/h/.copilot/patterns' as never);
    machine.ports.fs.copyTree(copy as never, '/h/.copilot/patterns' as never);
    expect(applyBackupModes(machine.ports, copy, '/h/.copilot/patterns')).toBe(4);
    const modes = machine.disk.listing().filter((line) => line.startsWith('/h/.copilot/patterns'));
    expect(modes).toContain('/h/.copilot/patterns/tools/run.sh file 755 "#!/bin/sh"');
    expect(modes).toContain('/h/.copilot/patterns/mine.md file 644 "mine"');
  });

  it('changes nothing when the manifest has no bits for the item', () => {
    const machine = createMemoryState();
    machine.disk.seedFile('/h/.copilot/x', 'x');
    expect(applyBackupModes(machine.ports, '/h/.agent-config-backups/20261120091403/1-x', '/h/.copilot/x')).toBe(0);
  });
});
