// DR-202 step 9: the commit point of a run. `components.lock` first, then `install-state.json` (its rename is the commit), then the
// journal is deleted. A kill before the state file's rename leaves the journal, so the next run restores. A kill after the rename
// leaves a finished run and a journal that `restoreFromJournal` recognises (`isCommitted`: the state file lists every journaled
// path) and deletes without undoing anything. So the entries of the new `install-state.json` must list every journaled link target
// and write hash (T138).
import { succeed, type Result } from '#shared/domain/result/Result.ts';
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
 * The rename of `install-state.json` is the commit point. Once both files are written the run has committed, so a journal that cannot be
 * deleted afterwards does not undo it: the answer says the journal was kept, and the next run recognises it as the journal of a committed
 * run and only deletes it (`isCommitted`).
 *
 * @param deps - the ports and roots
 * @param lock - the new `components.lock`
 * @param state - the new `install-state.json`
 * @returns `committed`, `journal-kept` when both files are written and the journal is still there, or why a file was refused; a disk
 *   failure while writing a file is thrown and leaves the journal in place
 */
export function commitRun(
  deps: StateDeps,
  lock: ComponentsLock,
  state: InstallState,
): Result<'committed' | 'journal-kept', StateFileFailure> {
  const lockWritten = writeComponentsLock(deps, lock);
  if (!lockWritten.ok) return lockWritten;
  const stateWritten = writeInstallState(deps, state);
  if (!stateWritten.ok) return stateWritten;
  try {
    const removed = removeJournal(deps);
    return removed.ok ? succeed('committed') : succeed('journal-kept');
  } catch {
    // The state file is renamed, so the run is done; a journal that stays is deleted by the next run, which finds it committed.
    return succeed('journal-kept');
  }
}
