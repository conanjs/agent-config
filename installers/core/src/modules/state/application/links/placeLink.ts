// Placing one link (DR-202, C-7): create it when the path is free, switch it when it is a link, and on Windows climb the ladder when
// the account cannot make a symbolic link. A path that holds a real file or folder is never replaced here (the caller backed it up
// and said so in the journal).
import { refuse, succeed, type Result } from '#shared/domain/result/Result.ts';
import { containIn, containLinkTarget } from '#state/application/files/containIn.ts';
import type { LinkKind } from '#state/application/ports/Links.ts';
import type { StateDeps } from '#state/application/StateDeps.ts';

/** What was placed: the kind may be lower than asked on Windows (a junction for a folder, a hash-tracked copy for a file). */
export interface PlacedLink {
  /** `copy` is the last rung of the Windows ladder for a file. */
  readonly kind: LinkKind | 'copy';
  /** True when the kind is lower than the one asked for; the report says so (C-7). */
  readonly degraded: boolean;
  /** `already` when the link was in place with this target; `switched` when an old link was replaced; `created` otherwise. */
  readonly how: 'created' | 'switched' | 'already';
}

/** Why a link was not placed. */
export interface LinkRefusal {
  /** `outside`: the path or target leaves the roots (M-03, M-04). `occupied`: a real file or folder is at the path. */
  readonly kind: 'outside' | 'occupied';
  /** One sentence, never repeating the path. */
  readonly reason: string;
}

/** What to place. */
export interface PlaceRequest {
  /** The absolute path of the link. */
  readonly path: string;
  /** Where it points: an absolute path inside the home. */
  readonly target: string;
  /** The kind asked for. */
  readonly kind: LinkKind;
  /**
   * Folders outside the home that the target may lie in: the folder of a `path` source or the checkout of agent-config, linked live
   * (AC-3.2). The caller has checked them against the user's home and the agent home (M-03); a target outside the home and outside
   * these is refused (M-04). Left out, only the home and the agent folders are allowed.
   */
  readonly targetRoots?: readonly string[];
  /** Links of the home that the installer placed itself, which this link may point at without following them (see `TargetAllowance`). */
  readonly ownLinks?: readonly string[];
}

// The first rung that works. POSIX has one rung; Windows tries a symbolic link, then a junction (folders only), then a copy (files).
function createOnLadder(
  deps: StateDeps,
  link: string,
  request: PlaceRequest,
  targetIsFolder: boolean,
  checkedTarget: string,
): PlacedLink {
  const asChecked = link as Parameters<StateDeps['links']['createLink']>[0];
  if (deps.flavor === 'posix') {
    deps.links.createLink(asChecked, request.target, request.kind);
    return { kind: request.kind, degraded: false, how: 'created' };
  }
  try {
    deps.links.createLink(asChecked, request.target, 'symlink');
    return { kind: 'symlink', degraded: false, how: 'created' };
  } catch (symlinkError) {
    if (targetIsFolder) {
      deps.links.createLink(asChecked, request.target, 'junction');
      return { kind: 'junction', degraded: true, how: 'created' };
    }
    try {
      deps.fs.copyTree(checkedTarget as Parameters<StateDeps['fs']['copyTree']>[0], asChecked);
    } catch {
      // The copy failed too: the symbolic link error is the one that explains why a link was wanted and could not be made.
      throw symlinkError;
    }
    return { kind: 'copy', degraded: true, how: 'created' };
  }
}

/**
 * Creates, switches or leaves in place one link at a path, with the Windows ladder when a symbolic link is not allowed.
 *
 * @param deps - the ports and roots
 * @param request - the path, the target and the kind
 * @returns what was placed, or why the path was refused; a failure of the disk (for example links not permitted) is thrown
 */
export function placeLink(deps: StateDeps, request: PlaceRequest): Result<PlacedLink, LinkRefusal> {
  const link = containIn(deps, request.path, 'keep-link');
  if (!link.ok) return refuse({ kind: 'outside', reason: link.error.reason });
  const target = containLinkTarget(deps, request.target, {
    targetRoots: request.targetRoots ?? [],
    ownLinks: request.ownLinks ?? [],
  });
  if (!target.ok) return refuse({ kind: 'outside', reason: target.error.reason });
  const present = deps.fs.stat(link.value);
  if (present === undefined) {
    const found = deps.fs.stat(target.value);
    return succeed(createOnLadder(deps, link.value, request, found?.kind === 'folder', target.value));
  }
  if (present.kind !== 'link') return refuse({ kind: 'occupied', reason: 'a file or folder is where the link goes' });
  if (deps.links.readLink(link.value) === request.target)
    return succeed({ kind: request.kind, degraded: false, how: 'already' });
  if (deps.flavor === 'posix') {
    deps.links.switchLink(link.value, request.target, request.kind);
    return succeed({ kind: request.kind, degraded: false, how: 'switched' });
  }
  // Windows has no atomic switch: remove, then create. A kill between the two is what the journal restores (mid-switch).
  deps.links.removeLink(link.value);
  const created = createOnLadder(
    deps,
    link.value,
    request,
    deps.fs.stat(target.value)?.kind === 'folder',
    target.value,
  );
  return succeed({ ...created, how: 'switched' });
}
