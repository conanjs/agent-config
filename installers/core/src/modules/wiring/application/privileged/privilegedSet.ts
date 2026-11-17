import type { PathFlavor } from '#shared/domain/path/PathContainment.ts';
import type { Result } from '#shared/domain/result/Result.ts';
import { compatLinkTable } from '#wiring/domain/compat/CompatLinks.ts';
import {
  computePrivilegedSet,
  diffPrivileged,
  privilegedSetHash,
  type ApprovedRecord,
  type PrivilegedDiff,
  type PrivilegedEntry,
  type PrivilegedRefusal,
  type PrivilegedSource,
} from '#wiring/domain/privileged/PrivilegedSet.ts';

/** What the consent check of one run needs. */
export interface ConsentRequest {
  /** The components to install, with their commits and manifests' privileged parts. */
  readonly sources: readonly PrivilegedSource[];
  /** The install-state entries recorded at an earlier approval (path starting `privileged:`), with their hashes. */
  readonly approved: readonly ApprovedRecord[];
  /** The user's home folder. */
  readonly userHome: string;
  /** The agent home. */
  readonly home: string;
  /** The path syntax. */
  readonly flavor: PathFlavor;
}

/** The answer of the consent check. */
export interface ConsentCheck {
  /** The whole set, sorted by key. */
  readonly entries: readonly PrivilegedEntry[];
  /** The hash to store as `approved_privileged_hash` once V approves. */
  readonly hash: string;
  /** What is new or changed (needs V's approval) and what went away. */
  readonly diff: PrivilegedDiff;
}

/**
 * Computes the privileged set of a run and diffs it against what V approved (M-01).
 *
 * @param request - the components, the recorded approvals and the homes
 * @returns the set, its hash and the diff; or every refusal, which stops the run with exit 1 before any need is shown
 */
export function checkPrivileged(request: ConsentRequest): Result<ConsentCheck, readonly PrivilegedRefusal[]> {
  const compatPaths = compatLinkTable(request.userHome, request.home, request.flavor).map((link) => link.path);
  const set = computePrivilegedSet(request.sources, { compatPaths });
  if (!set.ok) return set;
  return {
    ok: true,
    value: {
      entries: set.value,
      hash: privilegedSetHash(set.value),
      diff: diffPrivileged(set.value, request.approved),
    },
  };
}
