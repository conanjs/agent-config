// M-03, M-10, the PathContainment.ts header and the homeIdentity.ts header: create the agent home owner-only, then check its identity
// again before anything is written into it. `verifyHomeOnDisk` (variables module) checks the chosen home before it exists; a link or
// mount that appears between that check and the first write would otherwise carry the write into the user's home or a folder above it.
import { checkHomeIdentity } from '#shared/application/containment/homeIdentity.ts';
import { refuse, succeed, type Result } from '#shared/domain/result/Result.ts';
import { ensureFolder } from '#state/application/home/ensureFolder.ts';
import type { StateDeps } from '#state/application/StateDeps.ts';

/** Why the home is not usable. */
export interface HomeFolderRefusal {
  /** One sentence for MG-41. */
  readonly reason: string;
}

/**
 * Creates the agent home (and any missing level above it) owner-only, then proves it is not the user's home or a folder that holds it.
 *
 * Runs after the home is confirmed and before the first write (the lock file included).
 *
 * @param deps - the file operations, the disk's answers, the path syntax and the home to create
 * @param userHome - the folder the agent home must not be, or sit above
 * @returns `created` or `existed`, or why the home is refused (a folder that was just created stays; it is empty)
 */
export function createHomeFolder(
  deps: Pick<StateDeps, 'fs' | 'probe' | 'flavor' | 'home'>,
  userHome: string,
): Result<'created' | 'existed', HomeFolderRefusal> {
  const ensured = ensureFolder(deps, deps.home);
  if (!ensured.ok) return refuse({ reason: ensured.error.reason });
  const identity = checkHomeIdentity(deps.home, userHome, deps.flavor, deps.probe);
  return identity.ok ? succeed(ensured.value) : refuse({ reason: identity.error });
}
