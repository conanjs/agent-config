// DR-203, AC-7.3: the backup folder name, the clash suffix and the manifest.
import { describe, expect, it } from 'vitest';
import {
  backupFolderName,
  emitBackupManifest,
  freeBackupFolderName,
  isBackupFolderName,
  parseBackupManifest,
  sortBackupFolderNames,
} from '#state/domain/backup/BackupManifest.ts';

describe('the backup folder name', () => {
  it('is the UTC time of the clock as yyyyMMddHHmmss', () => {
    expect(backupFolderName(new Date('2026-11-20T09:14:03.456Z'))).toBe('20261120091403');
  });

  it.each([
    ['free', new Set<string>(), '20261120091403'],
    ['taken once', new Set(['20261120091403']), '20261120091403.1'],
    ['taken twice', new Set(['20261120091403', '20261120091403.1']), '20261120091403.2'],
    ['a gap is reused', new Set(['20261120091403', '20261120091403.2']), '20261120091403.1'],
  ])('takes the next free name when %s', (_title, taken, expected) => {
    expect(freeBackupFolderName('20261120091403', taken)).toBe(expected);
  });

  it('gives up after 999 clashes', () => {
    const taken = new Set(['x', ...Array.from({ length: 999 }, (_unused, index) => `x.${index + 1}`)]);
    expect(freeBackupFolderName('x', taken)).toBeUndefined();
  });

  it.each([
    ['20261120091403', true],
    ['20261120091403.2', true],
    ['2026112009140', false],
    ['20261120091403.', false],
    ['20261120091403.1234', false],
    ['latest', false],
    ['../20261120091403', false],
    ['20261120091403/x', false],
  ])('%j is a backup folder name: %s', (name, expected) => {
    expect(isBackupFolderName(name)).toBe(expected);
  });

  it('orders by time, then by clash number as a number', () => {
    expect(
      sortBackupFolderNames(['20261121000000', '20261120091403.10', '20261120091403', '20261120091403.2']),
    ).toEqual(['20261120091403', '20261120091403.2', '20261120091403.10', '20261121000000']);
  });
});

describe('the backup manifest', () => {
  const manifest = {
    created: '2026-11-20T09:14:03.000Z',
    items: [{ original: '/h/.copilot/patterns', backup: '1-patterns', kind: 'folder' as const, hash: 'd'.repeat(64) }],
  };

  it('reads back what it wrote', () => {
    expect(parseBackupManifest(emitBackupManifest(manifest))).toEqual({ ok: true, value: manifest });
  });

  it.each([
    ['empty', ''],
    ['not JSON', 'x'],
    ['another schema', emitBackupManifest(manifest).replace('backup-manifest/v1', 'v2')],
    ['an item of an unknown kind', emitBackupManifest(manifest).replace('"folder"', '"socket"')],
    ['an item with a short hash', emitBackupManifest(manifest).replace('d'.repeat(64), 'dd')],
    ['no items', JSON.stringify({ schema: 'backup-manifest/v1', created: 'x' })],
  ])('refuses %s', (_title, text) => {
    expect(parseBackupManifest(text).ok).toBe(false);
  });
});
