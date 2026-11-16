// DR-202 step 9: the commit point of a run. `components.lock` first, then `install-state.json` (its rename is the commit), then the
// journal is deleted. A kill before the state file's rename leaves the journal, so the next run restores. A kill after the rename
// leaves a finished run and a journal that `restoreFromJournal` recognises (`isCommitted`: the state file lists every journaled
// path) and deletes without undoing anything. So the entries of the new `install-state.json` must list every journaled link target
// and write hash (T138).
import { refuse, succeed, type Result } from '#shared/domain/result/Result.ts';
import type { ComponentsLock } from '#state/domain/components/ComponentsLock.ts';
import type { InstallState } from '#state/domain/installState/InstallState.ts';
import {
  removeJournal,
  writeComponentsLock,
  writeInstallState,
  type StateFileFailure,
} from '#state/application/files/stateFiles.ts';
import type { StateDeps } from '#state/application/StateDeps.ts';

/**
 * Commits a run: writes the lock, then the install state, then deletes the journal.
 *
 * @param deps - the ports and roots
 * @param lock - the new `components.lock`
 * @param state - the new `install-state.json`
 * @returns `committed`, or why a file was refused; a disk failure is thrown and leaves the journal in place
 */
export function commitRun(
  deps: StateDeps,
  lock: ComponentsLock,
  state: InstallState,
): Result<'committed', StateFileFailure> {
  const lockWritten = writeComponentsLock(deps, lock);
  if (!lockWritten.ok) return lockWritten;
  const stateWritten = writeInstallState(deps, state);
  if (!stateWritten.ok) return stateWritten;
  const removed = removeJournal(deps);
  return removed.ok ? succeed('committed') : refuse(removed.error);
}
