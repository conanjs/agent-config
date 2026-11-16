// `components.lock` (components-lock/v1, DR-403): what the installer resolved. The shape is judged by the contract reader of
// contracts/lib (through `parseContractFile`); this file only turns the accepted mapping into typed data and writes it back.
import { canonicalJson } from '#shared/domain/hash/canonicalJson.ts';
import { parseContractFile } from '#shared/domain/name/NameRules.ts';
import { refuse, succeed, type Result } from '#shared/domain/result/Result.ts';

/** Plain JSON data, as the lock keeps the parts the installer only passes through (the source and the manifest summary). */
export type JsonObject = { readonly [key: string]: unknown };

/** What was fetched for a component. */
export type LockResolved =
  | { readonly commit: string; readonly tag?: string }
  | { readonly live: true; readonly path: string }
  | { readonly sha256: string };

/** One locked component. */
export interface LockEntry {
  /** The source from the list, as locked. */
  readonly source: JsonObject;
  /** The commit, live path or archive hash that `install` checks out again. */
  readonly resolved: LockResolved;
  /** `version`, `slot` and `contracts` read from the component's manifest. */
  readonly manifest?: JsonObject;
  /** `null` or the build stamp. */
  readonly build?: JsonObject | null;
  /** The 12 hex characters of the current tree under `store/`. */
  readonly store_id?: string;
}

/** The whole lock: component name to entry. */
export interface ComponentsLock {
  /** The locked components by name. */
  readonly components: Readonly<Record<string, LockEntry>>;
}

/** The file schema this installer writes and reads. */
export const COMPONENTS_LOCK_SCHEMA = 'components-lock/v1';

/** Why a state file cannot be used. */
export interface StateFileProblem {
  /** `newer-major`: written by a newer installer, never rewritten (DR-205). `corrupt`: not valid. */
  readonly kind: 'corrupt' | 'newer-major';
  /** One sentence for MG-38.cause; it never quotes the file. */
  readonly sentence: string;
}

const NEWER_MAJOR = /^[a-z-]+\/v([2-9]|[1-9]\d+)$/;

/**
 * Tells whether a JSON text names a schema major above the one this installer reads.
 *
 * @param text - the file text
 * @returns true for `<name>/v2` and above
 */
export function hasNewerMajor(text: string): boolean {
  try {
    const raw: unknown = JSON.parse(text);
    const schema = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>)['schema'] : undefined;
    return typeof schema === 'string' && NEWER_MAJOR.test(schema);
  } catch {
    // A text that is not JSON has no schema to read; the caller reports it as corrupt.
    return false;
  }
}

/**
 * Parses the text of `components.lock` into a lock, judged by the contract reader.
 *
 * @param text - the file text
 * @returns the lock, or why it is refused (a newer major, or a text the contract reader does not accept)
 */
export function parseComponentsLock(text: string): Result<ComponentsLock, StateFileProblem> {
  if (hasNewerMajor(text)) {
    return refuse({
      kind: 'newer-major',
      sentence: 'components.lock was written by a newer installer and is not rewritten',
    });
  }
  const parsed = parseContractFile(COMPONENTS_LOCK_SCHEMA, text);
  if (!parsed.ok) {
    return refuse({ kind: 'corrupt', sentence: 'components.lock is not a valid components-lock/v1 file' });
  }
  return succeed({ components: parsed.value['components'] as Readonly<Record<string, LockEntry>> });
}

/**
 * Writes the text of `components.lock`: JSON, keys sorted, two-space indentation, ending in a line feed.
 *
 * @param lock - the lock to write
 * @returns the file text
 */
export function emitComponentsLock(lock: ComponentsLock): string {
  const sorted: unknown = JSON.parse(canonicalJson({ schema: COMPONENTS_LOCK_SCHEMA, components: lock.components }));
  return `${JSON.stringify(sorted, null, 2)}\n`;
}
