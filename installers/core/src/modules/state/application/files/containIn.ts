// M-03, M-04: the one place that turns an absolute path into a checked path. The path must lie in the home or in one of the other
// roots by text, and `resolveContainedPath` then proves that no link on disk takes it out of that root.
import path from 'node:path';
import { resolveContainedPath, type FinalSegment } from '#shared/application/containment/resolveContainedPath.ts';
import { isSameOrInside } from '#shared/domain/path/PathContainment.ts';
import { refuse, succeed, type Result } from '#shared/domain/result/Result.ts';
import { checkedPathOf, type CheckedPath } from '#state/application/ports/CheckedPath.ts';
import type { StateDeps } from '#state/application/StateDeps.ts';

/** Why a path was refused as outside every root; the sentence never repeats the path. */
export interface ContainViolation {
  /** What is wrong, in one sentence. */
  readonly reason: string;
}

/**
 * Proves that the backups folder itself is a plain folder name inside its parent, links on disk followed.
 *
 * `containIn` cannot do this because a root is not a path inside itself; the backups folder is checked as the one name below its parent.
 *
 * @param deps - the ports and roots
 * @returns the checked path of the backups folder, or why it was refused
 */
export function containBackupsFolder(deps: StateDeps): Result<CheckedPath, ContainViolation> {
  const flavored = path[deps.flavor];
  const contained = resolveContainedPath({
    probe: deps.probe,
    root: flavored.dirname(deps.backups),
    relative: flavored.basename(deps.backups),
    flavor: deps.flavor,
    finalSegment: 'keep-link',
  });
  return contained.ok ? succeed(checkedPathOf(contained.value)) : refuse({ reason: contained.error.reason });
}

/**
 * Proves that an absolute path stays under the home, the backups folder or one of the roots, links on disk followed.
 *
 * @param deps - the ports, the home and the roots
 * @param absolutePath - the path an operation will touch
 * @param finalSegment - `keep-link` when the last segment is a link that is to be removed or replaced, else `follow-link`
 * @returns the checked path, or why it was refused
 */
export function containIn(
  deps: StateDeps,
  absolutePath: string,
  finalSegment: FinalSegment,
): Result<CheckedPath, ContainViolation> {
  const flavored = path[deps.flavor];
  const root = [deps.home, deps.backups, ...deps.roots].find((candidate) =>
    isSameOrInside(candidate, absolutePath, deps.flavor),
  );
  if (root === undefined) return refuse({ reason: 'the path is not inside the agent home or an agent folder' });
  const relative = flavored.relative(root, absolutePath).split(flavored.sep).join('/');
  const contained = resolveContainedPath({ probe: deps.probe, root, relative, flavor: deps.flavor, finalSegment });
  return contained.ok ? succeed(checkedPathOf(contained.value)) : refuse({ reason: contained.error.reason });
}
