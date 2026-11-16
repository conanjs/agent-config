// `install-state.json` (install-state/v1, installer-cli.md): every path the installer placed, with the hash or target that lets
// `uninstall` and `doctor` tell its own file from V's. Written at the commit point of a run. Field names mirror the file.
import { canonicalJson } from '#shared/domain/hash/canonicalJson.ts';
import { refuse, succeed, type Result } from '#shared/domain/result/Result.ts';
import { hasNewerMajor, type StateFileProblem } from '#state/domain/components/ComponentsLock.ts';

/** The file schema this installer writes and reads. */
export const INSTALL_STATE_SCHEMA = 'install-state/v1';

/** How the installer delivers a file (FR-015, DR-204). */
export type EntryClass = 'linked' | 'rendered' | 'generated' | 'compat';

/** What the installer placed at a path (the Windows ladder reports `copy` for a degraded link). */
export type EntryKind = 'symlink' | 'junction' | 'copy' | 'file' | 'merged-entry';

/** One path the installer placed. */
export interface InstallStateEntry {
  /** The absolute path, or a path inside a shared file for a merged entry. */
  readonly path: string;
  /** How it is delivered. */
  readonly class: EntryClass;
  /** What it is on disk. */
  readonly kind: EntryKind;
  /** The owning component. */
  readonly component: string;
  /** Whether it is in the privileged set (M-01). */
  readonly privileged: boolean;
  /** For a link: where it points. */
  readonly target?: string;
  /** For a file, a copy or a merged entry: the SHA-256 of what was written. */
  readonly hash?: string;
  /** For `compat`: the release that retires it. */
  readonly retires?: string;
  /** For `rendered`: expected to be true. */
  readonly read_only?: boolean;
}

/** The whole state of the last successful run. */
export interface InstallState {
  /** The installer that wrote it. */
  readonly installer: { readonly version: string; readonly commit: string };
  /** The confirmed agent home. */
  readonly home: string;
  /** The hash of the approved privileged set (M-01); absent before the first approval. */
  readonly approved_privileged_hash?: string;
  /** How the last run ended. */
  readonly last_run: { readonly time: string; readonly command: string; readonly exit: number };
  /** Component name to commit or `live`. */
  readonly components: Readonly<Record<string, string>>;
  /** Every placed path, one entry per path. */
  readonly entries: readonly InstallStateEntry[];
}

const MAX_ENTRIES = 100_000;
const MAX_TEXT = 4096;
const CLASSES: readonly string[] = ['linked', 'rendered', 'generated', 'compat'];
const KINDS: readonly string[] = ['symlink', 'junction', 'copy', 'file', 'merged-entry'];
const SHA256 = /^[0-9a-f]{64}$/;

type Raw = Readonly<Record<string, unknown>>;

function isRaw(value: unknown): value is Raw {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isText(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= MAX_TEXT && value.isWellFormed();
}

function optionalText(raw: Raw, key: string): boolean {
  return raw[key] === undefined || isText(raw[key]);
}

function hasEntryNames(value: Raw): boolean {
  return (
    isText(value['path']) &&
    isText(value['component']) &&
    optionalText(value, 'target') &&
    optionalText(value, 'retires')
  );
}

function hasEntryFlags(value: Raw): boolean {
  const hash = value['hash'];
  return (
    typeof value['class'] === 'string' &&
    CLASSES.includes(value['class']) &&
    typeof value['kind'] === 'string' &&
    KINDS.includes(value['kind']) &&
    typeof value['privileged'] === 'boolean' &&
    (hash === undefined || (typeof hash === 'string' && SHA256.test(hash))) &&
    (value['read_only'] === undefined || typeof value['read_only'] === 'boolean')
  );
}

function isEntry(value: unknown): value is InstallStateEntry {
  return isRaw(value) && hasEntryNames(value) && hasEntryFlags(value);
}

function isInstaller(value: unknown): boolean {
  return isRaw(value) && isText(value['version']) && isText(value['commit']);
}

function isLastRun(value: unknown): boolean {
  return isRaw(value) && isText(value['time']) && isText(value['command']) && Number.isInteger(value['exit']);
}

function isRunHeader(raw: Raw): boolean {
  const hash = raw['approved_privileged_hash'];
  const validHash = hash === undefined || (typeof hash === 'string' && SHA256.test(hash));
  return isInstaller(raw['installer']) && isLastRun(raw['last_run']) && isText(raw['home']) && validHash;
}

function isComponents(value: unknown): value is Readonly<Record<string, string>> {
  return isRaw(value) && Object.values(value).every((item) => isText(item));
}

const corrupt = (sentence: string): Result<never, StateFileProblem> => refuse({ kind: 'corrupt', sentence });

// The parsed document without its schema key, once every field has been checked.
function stateFrom(raw: Raw): Result<InstallState, StateFileProblem> {
  const entries = raw['entries'];
  if (!isRunHeader(raw) || !isComponents(raw['components']))
    return corrupt('install-state.json has a field that is missing or not valid');
  if (!Array.isArray(entries) || entries.length > MAX_ENTRIES || !entries.every(isEntry)) {
    return corrupt('install-state.json has an entry that is not valid');
  }
  if (new Set(entries.map((entry) => entry.path)).size !== entries.length)
    return corrupt('install-state.json lists one path twice');
  return succeed({
    installer: raw['installer'],
    home: raw['home'],
    ...(raw['approved_privileged_hash'] === undefined
      ? {}
      : { approved_privileged_hash: raw['approved_privileged_hash'] }),
    last_run: raw['last_run'],
    components: raw['components'],
    entries,
  } as InstallState);
}

/**
 * Turns the text of `install-state.json` into a checked state, or says why the file cannot be trusted.
 *
 * Every field is checked, and so is the invariant that a path has exactly one entry; a text that fails is `corrupt`, a schema of a
 * newer major is `newer-major` and is never rewritten (DR-205).
 *
 * @param text - the file text
 * @returns the state, or why it is refused (the sentence never quotes the file)
 */
export function parseInstallState(text: string): Result<InstallState, StateFileProblem> {
  if (hasNewerMajor(text)) {
    return refuse({
      kind: 'newer-major',
      sentence: 'install-state.json was written by a newer installer and is not rewritten',
    });
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    // The text is not JSON: report it as corrupt without quoting it.
    return corrupt('install-state.json is not valid JSON');
  }
  if (!isRaw(raw) || raw['schema'] !== INSTALL_STATE_SCHEMA)
    return corrupt('install-state.json is not an install-state/v1 file');
  return stateFrom(raw);
}

/**
 * Writes the text of `install-state.json`: JSON, keys sorted, two-space indentation, ending in a line feed. Entries are sorted by path,
 * so the same run always gives the same bytes.
 *
 * @param state - the state to write
 * @returns the file text
 */
export function emitInstallState(state: InstallState): string {
  const entries = [...state.entries].sort((left, right) =>
    left.path < right.path ? -1 : left.path > right.path ? 1 : 0,
  );
  const sorted: unknown = JSON.parse(canonicalJson({ ...state, entries, schema: INSTALL_STATE_SCHEMA }));
  return `${JSON.stringify(sorted, null, 2)}\n`;
}
