// M-03, the pure half of path containment: text-only checks on absolute paths. Touching the disk (following links) is the
// application layer's job through the PathProbe port, so every function here gives the same answer on every machine.
//
// FOR T135 (the home resolver): refuse an AGENT_CONFIG_HOME (and a recorded home) that is a file system root (`/`, `C:\`) or the
// user's own home folder: every uninstall, backup and containment rule treats the home as a folder the installer owns, and `~`
// itself is not one. Also refuse a home that is not absolute (isSameOrInside is false for it, so every check would refuse).
import path from 'node:path';
import { parseRelativePath, type NameViolation, type RelativePath } from '#shared/domain/name/NameRules.ts';
import { refuse, succeed, type Result } from '#shared/domain/result/Result.ts';

/** The path syntax a function reads: `win32` for `C:\Users\v`, `posix` for `/home/v`. The caller takes it from the Environment port. */
export type PathFlavor = 'posix' | 'win32';

/** Why a path was refused as outside its root. */
export type ContainmentViolation =
  | NameViolation
  | { readonly kind: 'root-not-absolute'; readonly reason: string }
  | { readonly kind: 'escapes-root'; readonly reason: string }
  | { readonly kind: 'cannot-check'; readonly reason: string };

/**
 * Tells whether a candidate path is the root itself or lies below it, comparing text only.
 *
 * Both paths must be absolute in the flavor, which also keeps the answer independent of the working folder; a `win32` answer
 * ignores letter case and is false across drives and for UNC paths outside the root. A sibling whose name starts with the
 * root's name (`/home/v/.agent-config-evil`) is outside.
 *
 * @param root - the absolute root folder
 * @param candidate - the absolute path to test
 * @param flavor - the path syntax of both paths
 * @returns true when the candidate is the root or below it
 */
export function isSameOrInside(root: string, candidate: string, flavor: PathFlavor): boolean {
  const flavored = path[flavor];
  if (!flavored.isAbsolute(root) || !flavored.isAbsolute(candidate)) return false;
  const relative = flavored.relative(root, candidate);
  if (relative === '') return true;
  const leavesRoot = relative === '..' || relative.startsWith(`..${flavored.sep}`);
  return !leavesRoot && !flavored.isAbsolute(relative);
}

/**
 * Joins a checked component path under a root, then confirms by text that the result is still under the root.
 *
 * The second check repeats what the M-03 text rules already guarantee; it stays so that a future change to those rules cannot
 * turn this into a way out of the root unnoticed.
 *
 * @param root - the absolute folder the path must stay in
 * @param relativeText - the component's path field, as written
 * @param flavor - the path syntax of the root
 * @returns the joined absolute path, or why it was refused (the refusal never repeats `relativeText`)
 */
export function joinUnderRoot(
  root: string,
  relativeText: string,
  flavor: PathFlavor,
): Result<string, ContainmentViolation> {
  if (!path[flavor].isAbsolute(root))
    return refuse({ kind: 'root-not-absolute', reason: 'the root must be an absolute path' });
  const parsed = parseRelativePath(relativeText);
  if (!parsed.ok) return parsed;
  const joined = path[flavor].join(root, ...segmentsOf(parsed.value));
  return isSameOrInside(root, joined, flavor)
    ? succeed(joined)
    : refuse({ kind: 'escapes-root', reason: 'the path leaves its root' });
}

function segmentsOf(relative: RelativePath): string[] {
  return relative.split('/').filter((segment) => segment !== '');
}
