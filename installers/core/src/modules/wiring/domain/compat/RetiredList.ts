// AC-8.3, M-14: `compat.yaml` of the agent-config checkout (`schema: compat-links/v1`) lists, per release, the compatibility links that
// are retired. This file reads that list and decides, for each, whether the installer removes it. The installer removes only a link that
// it recorded itself and that still points where it recorded; anything else stays, and a link a hook command still names is kept.
import path from 'node:path';
import { parseRelativePath } from '#shared/domain/name/NameRules.ts';
import { joinUnderRoot, type PathFlavor } from '#shared/domain/path/PathContainment.ts';
import { refuse, succeed, type Result } from '#shared/domain/result/Result.ts';
import type { Observation } from '#wiring/domain/compat/CompatPlan.ts';

/** The schema of `compat.yaml`. */
export const COMPAT_LIST_SCHEMA = 'compat-links/v1';

/** The most links one release may retire. */
export const MAX_RETIRED = 64;

/** An entry of the retired list, as an absolute path. */
export interface RetiredEntry {
  /** The path as the release wrote it, `~/...`. */
  readonly written: string;
  /** The absolute path below the user's home. */
  readonly path: string;
}

const BAD_ENTRY = 'each retired path starts with ~/ and passes the path rules (M-03)';

function decodeEntry(item: unknown, userHome: string, flavor: PathFlavor): Result<RetiredEntry, string> {
  if (typeof item !== 'string' || !item.startsWith('~/') || !parseRelativePath(item.slice(2)).ok)
    return refuse(BAD_ENTRY);
  const joined = joinUnderRoot(userHome, item.slice(2), flavor);
  return joined.ok ? succeed({ written: item, path: path[flavor].normalize(joined.value) }) : refuse(BAD_ENTRY);
}

// The `retired` field of a document whose schema is right: absent or null is an empty list.
function retiredField(parsed: unknown): Result<readonly unknown[], string> {
  if (parsed === undefined || parsed === null) return succeed([]);
  if (typeof parsed !== 'object' || Array.isArray(parsed)) return refuse('compat.yaml is not a mapping');
  const document = parsed as Record<string, unknown>;
  if (document['schema'] !== COMPAT_LIST_SCHEMA) return refuse(`compat.yaml must say "schema: ${COMPAT_LIST_SCHEMA}"`);
  const retired = document['retired'];
  if (retired === undefined || retired === null) return succeed([]);
  return Array.isArray(retired) && retired.length <= MAX_RETIRED
    ? succeed(retired as unknown[])
    : refuse(`retired must be a list of at most ${MAX_RETIRED} paths`);
}

/**
 * Reads the retired list from the plain data of `compat.yaml`.
 *
 * Each entry starts with `~/` and passes the M-03 path rules, so it names a path below the user's home and nothing else.
 *
 * @param parsed - the parsed document (`null` or `undefined` for no file or an empty file)
 * @param userHome - the user's home folder
 * @param flavor - the path syntax
 * @returns the entries in file order, or one sentence that says what is wrong (it never repeats a refused entry)
 */
export function decodeRetiredList(
  parsed: unknown,
  userHome: string,
  flavor: PathFlavor,
): Result<readonly RetiredEntry[], string> {
  const items = retiredField(parsed);
  if (!items.ok) return items;
  const entries: RetiredEntry[] = [];
  for (const item of items.value) {
    const entry = decodeEntry(item, userHome, flavor);
    if (!entry.ok) return entry;
    entries.push(entry.value);
  }
  return succeed(entries);
}

/** What the installer records about a link it placed: the path and where it pointed. */
export interface RecordedLink {
  /** The absolute path of the link. */
  readonly path: string;
  /** The target the installer recorded. */
  readonly target: string;
}

/** The outcome for one retired path, in the words of the report (MG-19). */
export type RetiredDecision =
  | { readonly path: string; readonly action: 'remove' }
  | { readonly path: string; readonly action: 'gone' }
  | { readonly path: string; readonly action: 'left'; readonly reason: 'not-own' }
  | { readonly path: string; readonly action: 'kept'; readonly reason: 'hook-command' | 'hook-files-unreadable' };

/** What `decideRetired` looks at for one path. */
export interface RetiredFacts {
  /** What is at the path now. */
  readonly observed: Observation;
  /** The link the install state recorded at this path (class compat), if any. */
  readonly recorded: RecordedLink | undefined;
  /** True when a hook or settings file names the path (M-14). */
  readonly usedByHook: boolean;
  /** True when a hook or settings file exists but could not be read, so nothing can be said about it. */
  readonly hookFilesUnreadable: boolean;
}

/**
 * Decides what happens to one retired path.
 *
 * Only a link that the installer recorded and that still points at the recorded target is its own. A real file, a link to another
 * target and a path the installer never recorded stay (`left`). An own link that a hook command names, or that cannot be checked
 * because a hook file cannot be read, stays too (`kept`): the guard must not turn off silently (T-13).
 *
 * @param retiredPath - the absolute path from the retired list
 * @param facts - what is there, what was recorded and what the hook files say
 * @returns remove, gone (nothing there), left or kept
 */
export function decideRetired(retiredPath: string, facts: RetiredFacts): RetiredDecision {
  const { observed, recorded } = facts;
  if (observed.kind === 'absent') return { path: retiredPath, action: 'gone' };
  const own =
    observed.kind === 'link' &&
    recorded !== undefined &&
    recorded.path === retiredPath &&
    recorded.target === observed.target;
  if (!own) return { path: retiredPath, action: 'left', reason: 'not-own' };
  if (facts.usedByHook) return { path: retiredPath, action: 'kept', reason: 'hook-command' };
  if (facts.hookFilesUnreadable) return { path: retiredPath, action: 'kept', reason: 'hook-files-unreadable' };
  return { path: retiredPath, action: 'remove' };
}
