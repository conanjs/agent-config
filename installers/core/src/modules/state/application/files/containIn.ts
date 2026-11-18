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

/** Where a link may point besides the home and the agent folders. */
export interface TargetAllowance {
  /** Folders outside the home that this link may point into: the folder of a `path` source and the agent-config checkout. */
  readonly targetRoots: readonly string[];
  /**
   * Links of the home that the installer placed itself: earlier in this journal, or recorded in `install-state.json`, a component that is
   * kept as it was included. Only such a link may be the target of another link without being followed (a compatibility link points at
   * the mount link of the home); any other link under the home is judged by where it really points.
   */
  readonly ownLinks: readonly string[];
}

/**
 * Proves that the target of a link stays under the home, an agent folder, or one of the folders the caller names for this purpose.
 *
 * A `path` source and agent-config's own checkout are linked live from where they lie, outside the home (AC-3.2). The caller names
 * those folders after the manifests module checked them (M-03). A target is accepted when its canonical path, every link followed, is
 * inside the home, an agent folder or such a folder. The one exception is a link the installer placed itself, which is accepted as the
 * link; a link of V's or of another program that merely sits under the home (`{home}/x` pointing at a system folder) is never accepted.
 *
 * @param deps - the ports, the home and the roots
 * @param absolutePath - where the link points, as the run wrote it
 * @param allowance - the folders and the own links the target may be
 * @returns the checked path, or why it was refused
 */
export function containLinkTarget(
  deps: StateDeps,
  absolutePath: string,
  allowance: TargetAllowance,
): Result<CheckedPath, ContainViolation> {
  const inside = containIn(deps, absolutePath, 'follow-link');
  if (inside.ok) return inside;
  const own = allowance.ownLinks.some(
    (link) => path[deps.flavor].normalize(link) === path[deps.flavor].normalize(absolutePath),
  );
  const ownLink = own ? containIn(deps, absolutePath, 'keep-link') : inside;
  if (ownLink.ok) return ownLink;
  const real = deps.probe.realPath(absolutePath);
  if (real.kind !== 'real') return inside;
  const within = allowance.targetRoots.some((candidate) => {
    const root = deps.probe.realPath(candidate);
    return root.kind === 'real' && isSameOrInside(root.path, real.path, deps.flavor);
  });
  return within ? succeed(real.path as CheckedPath) : inside;
}
