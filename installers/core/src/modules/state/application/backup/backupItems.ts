// DR-203, AC-7.3, M-10: copy what the installer is about to replace or rewrite into `~/.agent-config-backups/<yyyyMMddHHmmss>/`, with a
// manifest. The folder is created only when there is something to copy; the folder and every copied folder are 0700 and every copied
// file 0600, and links are copied as links. Nothing is ever deleted from the backups folder.
import path from 'node:path';
import { canonicalJson } from '#shared/domain/hash/canonicalJson.ts';
import { sha256Hex } from '#shared/domain/hash/sha256Hex.ts';
import { refuse, succeed, type Result } from '#shared/domain/result/Result.ts';
import {
  backupFolderName,
  emitBackupManifest,
  freeBackupFolderName,
  isBackupFolderName,
  BACKUP_MANIFEST_FILE,
  type BackupItem,
} from '#state/domain/backup/BackupManifest.ts';
import { writeFileAtomically } from '#state/application/files/atomicFiles.ts';
import { containBackupsFolder, containIn } from '#state/application/files/containIn.ts';
import { ensureFolder } from '#state/application/home/ensureFolder.ts';
import type { CheckedPath } from '#state/application/ports/CheckedPath.ts';
import type { StateDeps } from '#state/application/StateDeps.ts';

/** What a backup run made. */
export type BackupResult =
  { readonly kind: 'none' } | { readonly kind: 'made'; readonly folder: string; readonly items: readonly BackupItem[] };

/** Why nothing was backed up (and nothing was replaced). */
export interface BackupFailure {
  /** One sentence for MG-38.cause, never repeating a path. */
  readonly reason: string;
}

const MAX_DEPTH = 32;

// A child of a checked folder, from a name `readDirectory` returned (never `.` or `..`), so it stays inside the checked folder.
function childOf(parent: CheckedPath, name: string, deps: StateDeps): CheckedPath {
  return path[deps.flavor].join(parent, name) as CheckedPath;
}

// Hashes what is at a path: a file by its content, a link by its target text, a folder by its sorted entries.
function hashOf(
  deps: StateDeps,
  at: CheckedPath,
  depth: number,
): { kind: BackupItem['kind']; hash: string } | undefined {
  const found = deps.fs.stat(at);
  if (found === undefined) return undefined;
  if (found.kind === 'link') return { kind: 'link', hash: sha256Hex(deps.links.readLink(at)) };
  if (found.kind === 'file') return { kind: 'file', hash: sha256Hex(deps.fs.readFile(at)) };
  if (found.kind !== 'folder' || depth > MAX_DEPTH) return undefined;
  const entries = deps.fs
    .readDirectory(at)
    .map((name) => [name, hashOf(deps, childOf(at, name, deps), depth + 1)?.hash ?? 'other'] as const);
  return { kind: 'folder', hash: sha256Hex(canonicalJson(entries)) };
}

// The permission bits of every file and folder under an item, by path inside it, before the copy is restricted to its owner.
function collectModes(deps: StateDeps, at: CheckedPath, relative: string, depth: number): [string, number][] {
  const found = deps.fs.stat(at);
  if (found === undefined || found.kind === 'link' || depth > MAX_DEPTH) return [];
  const own: [string, number][] = [[relative, found.mode]];
  if (found.kind !== 'folder') return own;
  const below = deps.fs
    .readDirectory(at)
    .flatMap((name) =>
      collectModes(deps, childOf(at, name, deps), relative === '' ? name : `${relative}/${name}`, depth + 1),
    );
  return [...own, ...below];
}

// Owner-only on the copy: folders 0700, files 0600, links untouched.
function restrictToOwner(deps: StateDeps, at: CheckedPath, depth: number): void {
  const found = deps.fs.stat(at);
  if (found === undefined || found.kind === 'link' || depth > MAX_DEPTH) return;
  if (found.kind === 'folder') {
    deps.fs.setMode(at, 0o700);
    for (const name of deps.fs.readDirectory(at)) restrictToOwner(deps, childOf(at, name, deps), depth + 1);
  } else if (found.kind === 'file') {
    deps.fs.setMode(at, 0o600);
  }
}

function chooseFolder(deps: StateDeps): string | undefined {
  const flavored = path[deps.flavor];
  const rootChecked = containBackupsFolder(deps);
  const taken = new Set(
    rootChecked.ok && deps.fs.exists(rootChecked.value)
      ? deps.fs.readDirectory(rootChecked.value).filter(isBackupFolderName)
      : [],
  );
  const name = freeBackupFolderName(backupFolderName(deps.clock.now()), taken);
  return name === undefined ? undefined : flavored.join(deps.backups, name);
}

/**
 * Backs up the items that exist; an item that does not exist is skipped.
 *
 * @param deps - the ports and roots
 * @param originals - absolute paths inside the home or an agent folder, in the order to list them
 * @returns `none` when nothing existed (no folder is made), the folder and its manifest items, or why nothing was backed up
 */
export function backupItems(deps: StateDeps, originals: readonly string[]): Result<BackupResult, BackupFailure> {
  const flavored = path[deps.flavor];
  const present = originals.filter((original) => {
    const checked = containIn(deps, original, 'keep-link');
    return checked.ok && deps.fs.exists(checked.value);
  });
  if (present.length === 0) return succeed({ kind: 'none' });
  const ensured = ensureFolder(deps, deps.backups);
  if (!ensured.ok) return refuse({ reason: ensured.error.reason });
  const folder = chooseFolder(deps);
  if (folder === undefined) return refuse({ reason: 'every backup folder name of this second is taken' });
  const folderChecked = containIn(deps, folder, 'keep-link');
  if (!folderChecked.ok) return refuse({ reason: folderChecked.error.reason });
  deps.fs.makeDirectory(folderChecked.value);
  const items: BackupItem[] = [];
  for (const [index, original] of present.entries()) {
    const source = containIn(deps, original, 'keep-link');
    const relative = `${index + 1}-${flavored.basename(original)}`;
    const copy = containIn(deps, flavored.join(folder, relative), 'keep-link');
    if (!source.ok) return refuse({ reason: source.error.reason });
    if (!copy.ok) return refuse({ reason: copy.error.reason });
    const facts = hashOf(deps, source.value, 0);
    if (facts === undefined) return refuse({ reason: 'an item is not a file, folder or link' });
    const modes = Object.fromEntries(collectModes(deps, source.value, '', 0));
    deps.fs.copyTree(source.value, copy.value);
    restrictToOwner(deps, copy.value, 0);
    items.push({ original, backup: relative, kind: facts.kind, hash: facts.hash, modes });
  }
  const manifest = emitBackupManifest({ created: deps.clock.now().toISOString(), items });
  const written = writeFileAtomically(deps, flavored.join(folder, BACKUP_MANIFEST_FILE), manifest);
  if (!written.ok) return refuse({ reason: 'the manifest cannot be written' });
  return succeed({ kind: 'made', folder, items });
}
