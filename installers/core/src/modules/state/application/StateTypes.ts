// The public types of the state module. Other modules import only `application/**` (docs/architecture.md section 4) and re-exports are
// not allowed (TSN-18), so each domain type they need is named here as an alias of the declaring type.
import type { BackupItem, BackupManifest } from '#state/domain/backup/BackupManifest.ts';
import type {
  ComponentsLock,
  LockEntry,
  LockResolved,
  StateFileProblem,
} from '#state/domain/components/ComponentsLock.ts';
import type { InstallState, InstallStateEntry } from '#state/domain/installState/InstallState.ts';
import type { Journal, JournalOperation, OldFile, OldLink } from '#state/domain/journal/Journal.ts';
import type { LogEntry } from '#state/domain/log/InstallLog.ts';
import type { LockRecord } from '#state/domain/lock/HomeLockRecord.ts';

/** The content of `components.lock`: component name to entry (components-lock/v1). */
export type StateComponentsLock = ComponentsLock;
/** One locked component: source, resolved commit or live path, manifest summary, build stamp, store id. */
export type StateLockEntry = LockEntry;
/** What was fetched for a component: a commit, a live path or an archive hash. */
export type StateLockResolved = LockResolved;
/** The content of `install-state.json` (install-state/v1). */
export type StateInstallState = InstallState;
/** One path the installer placed. */
export type StateInstallStateEntry = InstallStateEntry;
/** Why a state file cannot be used: `corrupt`, or `newer-major` (never rewritten). */
export type StateProblem = StateFileProblem;
/** The journal of one run (install-journal/v1). */
export type StateJournal = Journal;
/** One journaled link or write with what the path held before. */
export type StateJournalOperation = JournalOperation;
/** What a link path held before the run. */
export type StateOldLink = OldLink;
/** What a written file held before the run. */
export type StateOldFile = OldFile;
/** One line of `install-log.jsonl`. */
export type StateLogEntry = LogEntry;
/** One item of a backup manifest. */
export type StateBackupItem = BackupItem;
/** The manifest of one backup folder. */
export type StateBackupManifest = BackupManifest;
/** The holder written in `install.lock`. */
export type StateLockRecord = LockRecord;
