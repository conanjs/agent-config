// Creating a folder one level at a time and checking each level after it exists (the caller contract of `resolveContainedPath`): a
// link that appears between two levels cannot carry the next level out of the root. Used for the home and the backups folder.
import path from 'node:path';
import { resolveContainedPath } from '#shared/application/containment/resolveContainedPath.ts';
import { refuse, succeed, type Result } from '#shared/domain/result/Result.ts';
import { checkedPathOf } from '#state/application/ports/CheckedPath.ts';
import type { StateDeps } from '#state/application/StateDeps.ts';

/** Why a folder could not be ensured. */
export interface EnsureRefusal {
  /** One sentence, never repeating the path. */
  readonly reason: string;
}

/**
 * Makes sure a folder exists, creating the missing levels one by one, each owner-only (0700).
 *
 * @param deps - the ports (only `fs`, `probe` and `flavor` are used)
 * @param folder - the absolute folder
 * @returns `created` when at least one level was made, `existed`, or why a level was refused
 */
export function ensureFolder(
  deps: Pick<StateDeps, 'fs' | 'probe' | 'flavor'>,
  folder: string,
): Result<'created' | 'existed', EnsureRefusal> {
  const flavored = path[deps.flavor];
  const missing: string[] = [];
  let current = flavored.normalize(folder);
  while (deps.probe.realPath(current).kind === 'missing') {
    missing.unshift(current);
    const parent = flavored.dirname(current);
    if (parent === current) return refuse({ reason: 'no part of the folder exists' });
    current = parent;
  }
  if (deps.probe.realPath(current).kind === 'unknown') return refuse({ reason: 'the folder cannot be checked' });
  for (const level of missing) {
    const contained = resolveContainedPath({
      probe: deps.probe,
      root: flavored.dirname(level),
      relative: flavored.basename(level),
      flavor: deps.flavor,
      finalSegment: 'keep-link',
    });
    if (!contained.ok) return refuse({ reason: contained.error.reason });
    deps.fs.makeDirectory(checkedPathOf(contained.value));
  }
  return succeed(missing.length > 0 ? 'created' : 'existed');
}
