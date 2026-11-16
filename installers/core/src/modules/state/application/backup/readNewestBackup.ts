// `uninstall --restore` (A-D1) and `doctor` (AC-7.5): which backup folder is the newest, and what its manifest lists. Only folders
// named like a backup run are read, so nothing else in the backups folder is taken for one.
import path from 'node:path';
import { refuse, succeed, type Result } from '#shared/domain/result/Result.ts';
import {
  BACKUP_MANIFEST_FILE,
  isBackupFolderName,
  parseBackupManifest,
  sortBackupFolderNames,
  type BackupManifest,
} from '#state/domain/backup/BackupManifest.ts';
import { readFileIfPresent } from '#state/application/files/atomicFiles.ts';
import { containBackupsFolder } from '#state/application/files/containIn.ts';
import type { StateDeps } from '#state/application/StateDeps.ts';

/** The newest backup folder and its manifest. */
export interface NewestBackup {
  /** The absolute path of the backup folder. */
  readonly folder: string;
  /** What it lists. */
  readonly manifest: BackupManifest;
}

/** What looking for a backup gave. */
export type NewestBackupRead = { readonly kind: 'none' } | { readonly kind: 'found'; readonly backup: NewestBackup };

/** Why the newest backup cannot be used. */
export interface BackupReadFailure {
  /** One sentence for MG-38.cause. */
  readonly reason: string;
}

/**
 * Finds the newest backup folder and reads its manifest.
 *
 * @param deps - the ports and roots
 * @returns the backup, `none` when there is no backup, or why the newest one cannot be read
 */
export function readNewestBackup(deps: StateDeps): Result<NewestBackupRead, BackupReadFailure> {
  const root = containBackupsFolder(deps);
  if (!root.ok || !deps.fs.exists(root.value)) return succeed({ kind: 'none' });
  const names = sortBackupFolderNames(deps.fs.readDirectory(root.value).filter(isBackupFolderName));
  const newest = names.at(-1);
  if (newest === undefined) return succeed({ kind: 'none' });
  const folder = path[deps.flavor].join(deps.backups, newest);
  const read = readFileIfPresent(deps, path[deps.flavor].join(folder, BACKUP_MANIFEST_FILE));
  if (!read.ok || read.value.kind === 'absent') return refuse({ reason: 'the newest backup has no readable manifest' });
  const manifest = parseBackupManifest(read.value.text);
  return manifest.ok
    ? succeed({ kind: 'found', backup: { folder, manifest: manifest.value } })
    : refuse({ reason: manifest.error });
}
