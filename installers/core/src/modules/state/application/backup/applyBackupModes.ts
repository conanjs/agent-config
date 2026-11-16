// A backup copy is owner-only (M-10), so a copy that is put back would lose the permission bits of the original (a script would stop
// being executable). The manifest keeps them; this puts them back on the restored tree. Used by the journal restore and by
// `uninstall --restore` (T141).
import path from 'node:path';
import { BACKUP_MANIFEST_FILE, parseBackupManifest } from '#state/domain/backup/BackupManifest.ts';
import { containIn } from '#state/application/files/containIn.ts';
import { readFileIfPresent } from '#state/application/files/atomicFiles.ts';
import type { StateDeps } from '#state/application/StateDeps.ts';

// The bits the manifest of a backup folder records for one copy, if the manifest is readable and lists it.
function recordedModes(deps: StateDeps, backupPath: string): Readonly<Record<string, number>> | undefined {
  const flavored = path[deps.flavor];
  const read = readFileIfPresent(deps, flavored.join(flavored.dirname(backupPath), BACKUP_MANIFEST_FILE));
  if (!read.ok || read.value.kind !== 'text') return undefined;
  const manifest = parseBackupManifest(read.value.text);
  return manifest.ok
    ? manifest.value.items.find((item) => item.backup === flavored.basename(backupPath))?.modes
    : undefined;
}

/**
 * Puts the recorded permission bits back on a tree that was restored from a backup copy.
 *
 * Nothing is changed when the manifest cannot be read or has no bits for the item (the tree then stays owner-only, the safe side).
 *
 * @param deps - the ports and roots
 * @param backupPath - the absolute path of the copy inside its backup folder, as the journal or the manifest names it
 * @param restoredAt - the absolute path the copy was restored to
 * @returns how many paths got their bits back
 */
export function applyBackupModes(deps: StateDeps, backupPath: string, restoredAt: string): number {
  const flavored = path[deps.flavor];
  let applied = 0;
  for (const [relative, mode] of Object.entries(recordedModes(deps, backupPath) ?? {})) {
    const target = containIn(
      deps,
      relative === '' ? restoredAt : flavored.join(restoredAt, ...relative.split('/')),
      'keep-link',
    );
    const kind = target.ok ? deps.fs.stat(target.value)?.kind : undefined;
    if (target.ok && kind !== undefined && kind !== 'link') {
      deps.fs.setMode(target.value, mode);
      applied += 1;
    }
  }
  return applied;
}
