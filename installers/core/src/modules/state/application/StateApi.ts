import type { Result } from '#shared/domain/result/Result.ts';
import type { BackupFailure, BackupResult } from '#state/application/backup/backupItems.ts';
import type { NewestBackupRead, BackupReadFailure } from '#state/application/backup/readNewestBackup.ts';
import type { FileRefusal } from '#state/application/files/atomicFiles.ts';
import type { Loaded, StateFileFailure } from '#state/application/files/stateFiles.ts';
import type { HomeFolderRefusal } from '#state/application/home/createHomeFolder.ts';
import type { RestoreFailure, RestoreOutcome } from '#state/application/journal/restoreJournal.ts';
import type { SwitchedLink, SwitchFailure } from '#state/application/journal/switchLinks.ts';
import type { PlacedLink, LinkRefusal, PlaceRequest } from '#state/application/links/placeLink.ts';
import type { HomeLockHandle, LockRefusal, LockRequest } from '#state/application/lock/homeLock.ts';
import type {
  StateComponentsLock,
  StateInstallState,
  StateJournal,
  StateLogEntry,
} from '#state/application/StateTypes.ts';

/**
 * What the state module offers the commands: the files of a run, the journal and its restore, the home lock, backups, the log and
 * the store, with the disk reached only through the module's ports. Built by `composeState` in StateModule.ts and handed to the
 * commands by the composition root.
 */
export interface StateApi {
  /**
   * Creates the agent home owner-only and proves it is not the user's home or a folder above it, by file identity. Call it after the
   * home is confirmed, before the first write (the lock included).
   *
   * @param userHome - the user's home folder
   * @returns `created` or `existed`, or why the home is refused (MG-41)
   */
  createHome(userHome: string): Result<'created' | 'existed', HomeFolderRefusal>;

  /**
   * Takes the home lock, taking over one older than 10 minutes. Release it in a `finally` at the end of the run.
   *
   * @param request - the command, the pid and whether to wait up to 2 seconds
   * @returns the handle, who holds the lock (MG-30), or why the lock file cannot be used
   */
  acquireLock(request: LockRequest): Promise<Result<HomeLockHandle, LockRefusal>>;

  /**
   * Releases the lock this run took; another run's lock is left alone.
   *
   * @param handle - what `acquireLock` returned
   * @returns what happened to the file
   */
  releaseLock(handle: HomeLockHandle): 'removed' | 'changed' | 'absent';

  /**
   * Loads `components.lock` from the home, if the previous run left one.
   *
   * @returns the lock, `present: false` when there is none, or why it cannot be used
   */
  readComponentsLock(): Result<Loaded<StateComponentsLock>, StateFileFailure>;

  /**
   * Reads `install-state.json`; a newer major is refused.
   *
   * @returns the state, `present: false` when there is none, or why it cannot be used
   */
  readInstallState(): Result<Loaded<StateInstallState>, StateFileFailure>;

  /**
   * Writes the journal before the first switch of a run.
   *
   * @param journal - the plan's link and write operations with their old state
   * @returns `written`, or why the path was refused
   */
  writeJournal(journal: StateJournal): Result<'written', StateFileFailure>;

  /**
   * Writes a file by a temporary file and a rename, owner-only (generated files and the like).
   *
   * @param target - the absolute path
   * @param text - the content
   * @returns `written`, or why the path was refused
   */
  writeFile(target: string, text: string): Result<'written', FileRefusal>;

  /**
   * Places one link, climbing the Windows ladder when needed.
   *
   * @param request - the path, target and kind
   * @returns what was placed, or why it was refused
   */
  placeLink(request: PlaceRequest): Result<PlacedLink, LinkRefusal>;

  /**
   * Switches every link of the journal in order.
   *
   * @param journal - the journal that was just written
   * @returns what each link became, or the first refusal
   */
  switchLinks(journal: StateJournal): Result<readonly SwitchedLink[], SwitchFailure>;

  /**
   * Restores the previous state from the journal of an interrupted run, at the start of `install` and in `doctor`.
   *
   * @returns what was found and done, or why nothing was changed
   */
  restoreFromJournal(): Result<RestoreOutcome, RestoreFailure>;

  /**
   * Commits a run: lock file, then install state (the commit point), then deletes the journal.
   *
   * @param lock - the new `components.lock`
   * @param state - the new `install-state.json`
   * @returns `committed`, or why a file was refused
   */
  commit(lock: StateComponentsLock, state: StateInstallState): Result<'committed', StateFileFailure>;

  /**
   * Copies what is about to be replaced or rewritten into a new backup folder with a manifest; makes no folder when nothing exists.
   *
   * @param originals - absolute paths to back up
   * @returns the folder and its items, `none`, or why nothing was backed up
   */
  backup(originals: readonly string[]): Result<BackupResult, BackupFailure>;

  /**
   * Finds the newest backup and its manifest, for `uninstall --restore`.
   *
   * @returns the backup, `none`, or why it cannot be read
   */
  readNewestBackup(): Result<NewestBackupRead, BackupReadFailure>;

  /**
   * Appends this run's line to `install-log.jsonl`, rotating at 1 MiB.
   *
   * @param entry - what the run did
   * @returns what happened, or why the path was refused
   */
  appendLog(entry: StateLogEntry): Result<'appended' | 'rotated-and-appended', string>;

  /**
   * Deletes store trees older than the current and previous one of each component.
   *
   * @param currentIds - component name to the `store_id` of its current tree
   * @returns the folders deleted
   */
  pruneStore(currentIds: Readonly<Record<string, string>>): string[];
}
