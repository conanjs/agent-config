// The removal of a link the installer placed, for a retired compatibility link (AC-8.3, M-14). Only a link that still points at the
// target the caller names is removed; the link itself is checked (`keep-link`), never what it points at, and a real file or folder at
// the path is left alone.
import { refuse, succeed, type Result } from '#shared/domain/result/Result.ts';
import { containIn } from '#state/application/files/containIn.ts';
import type { StateDeps } from '#state/application/StateDeps.ts';

/** Why a link was not removed. */
export interface UnlinkRefusal {
  /** `outside`: the path leaves the roots (M-03, M-04). `not-own`: something else is there, or the link points elsewhere. */
  readonly kind: 'outside' | 'not-own';
  /** One sentence, never repeating the path. */
  readonly reason: string;
}

/** Which link to remove and what it must still point at. */
export interface UnlinkRequest {
  /** The absolute path of the link. */
  readonly path: string;
  /** The target the installer recorded; a link that points elsewhere is not removed. */
  readonly target: string;
}

/**
 * Removes a link only while it still points at the target the installer recorded.
 *
 * @param deps - the ports and roots
 * @param request - the absolute path of the link and the target it must still have
 * @returns `removed`, `absent` when nothing is there, or why the path was left
 */
export function removeOwnLink(deps: StateDeps, request: UnlinkRequest): Result<'removed' | 'absent', UnlinkRefusal> {
  const checked = containIn(deps, request.path, 'keep-link');
  if (!checked.ok) return refuse({ kind: 'outside', reason: checked.error.reason });
  const found = deps.fs.stat(checked.value);
  if (found === undefined) return succeed('absent');
  if (found.kind !== 'link' || deps.links.readLink(checked.value) !== request.target) {
    return refuse({ kind: 'not-own', reason: 'what is there is not the link the installer placed' });
  }
  deps.links.removeLink(checked.value);
  return succeed('removed');
}
