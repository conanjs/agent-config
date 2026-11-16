// Backups (DR-203, AC-7.3, M-10): `~/.agent-config-backups/<yyyyMMddHHmmss>/` with a `backup-manifest.json` that lists every item
// copied before the installer replaced or rewrote it. Pure rules: the folder name, the clash suffix, the manifest text.
import { canonicalJson } from '#shared/domain/hash/canonicalJson.ts';
import { refuse, succeed, type Result } from '#shared/domain/result/Result.ts';

/** The file schema this installer writes and reads. */
export const BACKUP_MANIFEST_SCHEMA = 'backup-manifest/v1';

/** The file V's two local files and every item list is written under. */
export const BACKUP_MANIFEST_FILE = 'backup-manifest.json';

/** One backed-up item. */
export interface BackupItem {
  /** Where it was. */
  readonly original: string;
  /** Where its copy is, inside the backup folder. */
  readonly backup: string;
  /** What it was. */
  readonly kind: 'file' | 'folder' | 'link';
  /** The SHA-256 of a file; for a folder the SHA-256 of its sorted entries; for a link the SHA-256 of its target text. */
  readonly hash: string;
  /**
   * The permission bits the original files and folders had, by path inside the item (`""` is the item itself, `a/b.sh` a file below it).
   * The copy itself is owner-only (M-10), so a restore puts these back and keeps scripts executable. Links have no entry.
   */
  readonly modes?: Readonly<Record<string, number>>;
}

/** The manifest of one backup folder. */
export interface BackupManifest {
  /** When the run made it. */
  readonly created: string;
  /** What it holds, in the order it was copied. */
  readonly items: readonly BackupItem[];
}

const FOLDER_NAME = /^\d{14}(\.\d{1,3})?$/;
const SHA256 = /^[0-9a-f]{64}$/;
const MAX_ITEMS = 10_000;
const MAX_CLASH_SUFFIX = 999;

/**
 * Names the backup folder of a run from the clock: the UTC instant as `yyyyMMddHHmmss`.
 *
 * @param now - the instant of the Clock
 * @returns for example `20261120091403` for 2026-11-20T09:14:03Z
 */
export function backupFolderName(now: Date): string {
  return now
    .toISOString()
    .replace(/\.\d+Z$/, '')
    .replace(/[-:T]/g, '');
}

/**
 * Picks a folder name that is not taken: the plain name, else the name with `.1`, `.2` and so on.
 *
 * @param base - the name from {@link backupFolderName}
 * @param taken - the names that exist
 * @returns the free name, or `undefined` after 999 clashes
 */
export function freeBackupFolderName(base: string, taken: ReadonlySet<string>): string | undefined {
  if (!taken.has(base)) return base;
  for (let suffix = 1; suffix <= MAX_CLASH_SUFFIX; suffix += 1) {
    if (!taken.has(`${base}.${suffix}`)) return `${base}.${suffix}`;
  }
  return undefined;
}

/**
 * Tells whether a folder name is one a backup run makes (so `--restore` and `doctor` never read another folder as a backup).
 *
 * @param name - a folder name inside the backups folder
 * @returns true for `yyyyMMddHHmmss` with an optional `.N`
 */
export function isBackupFolderName(name: string): boolean {
  return FOLDER_NAME.test(name);
}

/**
 * Orders backup folder names oldest first: by the time, then by the clash number.
 *
 * @param names - names that pass {@link isBackupFolderName}
 * @returns a new sorted list
 */
export function sortBackupFolderNames(names: readonly string[]): string[] {
  const key = (name: string): [string, number] => {
    const [stamp = '', suffix = '0'] = name.split('.');
    return [stamp, Number(suffix)];
  };
  return [...names].sort((left, right) => {
    const [leftStamp, leftSuffix] = key(left);
    const [rightStamp, rightSuffix] = key(right);
    return leftStamp === rightStamp ? leftSuffix - rightSuffix : leftStamp < rightStamp ? -1 : 1;
  });
}

/**
 * Writes the text of a backup manifest: JSON, keys sorted, ending in a line feed.
 *
 * @param manifest - the time of the run and the items it copied
 * @returns the file text
 */
export function emitBackupManifest(manifest: BackupManifest): string {
  const sorted: unknown = JSON.parse(canonicalJson({ ...manifest, schema: BACKUP_MANIFEST_SCHEMA }));
  return `${JSON.stringify(sorted, null, 2)}\n`;
}

function hasValidModes(modes: unknown): boolean {
  if (modes === undefined) return true;
  if (typeof modes !== 'object' || modes === null || Array.isArray(modes)) return false;
  const entries = Object.entries(modes);
  return (
    entries.length <= MAX_ITEMS &&
    entries.every(
      ([name, mode]) =>
        name.length <= 4096 && Number.isInteger(mode) && (mode as number) >= 0 && (mode as number) <= 0o7777,
    )
  );
}

function isItem(value: unknown): value is BackupItem {
  if (typeof value !== 'object' || value === null) return false;
  const item = value as Record<string, unknown>;
  const text = (key: string): boolean => {
    const field = item[key];
    return typeof field === 'string' && field.length > 0 && field.length <= 4096;
  };
  return (
    text('original') &&
    text('backup') &&
    (item['kind'] === 'file' || item['kind'] === 'folder' || item['kind'] === 'link') &&
    typeof item['hash'] === 'string' &&
    SHA256.test(item['hash']) &&
    hasValidModes(item['modes'])
  );
}

/**
 * Reads the text of a backup manifest (for `uninstall --restore` and `doctor`); the file is on disk, so every field is checked.
 *
 * @param text - the file text
 * @returns the manifest, or the sentence that says why it cannot be used
 */
export function parseBackupManifest(text: string): Result<BackupManifest, string> {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    // Not JSON: reported as unreadable, without quoting the file.
    return refuse('the backup manifest is not valid JSON');
  }
  if (typeof raw !== 'object' || raw === null) return refuse('the backup manifest is not a backup-manifest/v1 file');
  const { schema, created, items } = raw as Record<string, unknown>;
  if (schema !== BACKUP_MANIFEST_SCHEMA || typeof created !== 'string')
    return refuse('the backup manifest is not a backup-manifest/v1 file');
  if (!Array.isArray(items) || items.length > MAX_ITEMS || !items.every(isItem))
    return refuse('the backup manifest has an item that is not valid');
  return succeed({ created, items });
}
