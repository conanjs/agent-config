// DR-202, DR-205, EDGE-4: put every path of an interrupted run back as it was, then delete the journal. Runs at the start of the next
// `install` and in `doctor`. Every journaled path is proven to be inside the home or an agent folder before anything changes, because
// the journal is a file on disk that could have been edited. Operations are undone last to first, each by the rules in Journal.ts, and
// the journal goes last, so a crash during a restore is finished by the next one.
import { sha256Hex } from '#shared/domain/hash/sha256Hex.ts';
import { refuse, succeed, type Result } from '#shared/domain/result/Result.ts';
import {
  decideRestore,
  isCommitted,
  type JournalOperation,
  type Observed,
  type RestoreStep,
} from '#state/domain/journal/Journal.ts';
import { applyBackupModes } from '#state/application/backup/applyBackupModes.ts';
import { containIn } from '#state/application/files/containIn.ts';
import {
  readInstallState,
  readJournal,
  removeJournal,
  STATE_FILES,
  type StateFileFailure,
} from '#state/application/files/stateFiles.ts';
import type { CheckedPath } from '#state/application/ports/CheckedPath.ts';
import type { StateDeps } from '#state/application/StateDeps.ts';
import path from 'node:path';

/** One path the restore touched or left. */
export interface RestoreRecord {
  /** The absolute path. */
  readonly path: string;
  /** What was done: `removed`, `switched-back`, `recreated`, `restored-from-backup`, or `left`. */
  readonly action: 'removed' | 'switched-back' | 'recreated' | 'restored-from-backup' | 'left' | 'nothing';
  /** For `left`: why. */
  readonly why?: string;
}

/** What a restore did. */
export interface RestoreReport {
  /** The absolute path of the journal that was replayed, printed by the `interrupted-install` finding. */
  readonly journalPath: string;
  /** One record per journaled operation, in the order they were undone. */
  readonly records: readonly RestoreRecord[];
}

/** Why a restore did not run; nothing was changed. */
export type RestoreFailure =
  | { readonly kind: 'journal'; readonly failure: StateFileFailure }
  | { readonly kind: 'outside'; readonly reason: string };

/** What a restore found: no journal, the journal of a run that had committed (deleted, nothing undone), or an interrupted run that was restored. */
export type RestoreOutcome =
  | { readonly interrupted: false; readonly discarded: boolean }
  | { readonly interrupted: true; readonly report: RestoreReport };

interface Resolved {
  readonly operation: JournalOperation;
  readonly at: CheckedPath;
  readonly backup: CheckedPath | undefined;
}

function backupOf(operation: JournalOperation): string | undefined {
  return operation.old.state === 'backed-up' || operation.old.state === 'file' ? operation.old.backup : undefined;
}

function observe(deps: StateDeps, operation: JournalOperation, at: CheckedPath): Observed {
  const found = deps.fs.stat(at);
  if (found === undefined) return { kind: 'absent' };
  if (found.kind === 'link') return { kind: 'link', target: deps.links.readLink(at) };
  if (found.kind === 'file')
    return { kind: 'file', hash: operation.op === 'write' ? sha256Hex(deps.fs.readFile(at)) : '' };
  return { kind: found.kind };
}

function switchBack(deps: StateDeps, at: CheckedPath, target: string, kind: 'symlink' | 'junction'): void {
  if (deps.flavor === 'posix') {
    deps.links.switchLink(at, target, kind);
  } else {
    deps.links.removeLink(at);
    deps.links.createLink(at, target, kind);
  }
}

// Puts the backup's copy where the path was, after the link of this run (if any) is removed; `undefined` when the backup is gone.
function copyBack(deps: StateDeps, item: Resolved, removeLinkFirst: boolean): RestoreRecord['action'] | undefined {
  const { at, backup } = item;
  if (backup === undefined || !deps.fs.exists(backup)) return undefined;
  if (removeLinkFirst) deps.links.removeLink(at);
  if (deps.fs.exists(at)) deps.fs.remove(at);
  deps.fs.copyTree(backup, at);
  applyBackupModes(deps, backup, at);
  return 'restored-from-backup';
}

// Performs the file or link change of one step and names what happened; `nothing` and `leave` change no disk.
function change(deps: StateDeps, item: Resolved, step: RestoreStep): RestoreRecord['action'] | undefined {
  const { at } = item;
  switch (step.action) {
    case 'nothing':
    case 'leave':
      return step.action === 'nothing' ? 'nothing' : 'left';
    case 'remove-link':
      deps.links.removeLink(at);
      return 'removed';
    case 'remove-file':
      deps.fs.remove(at);
      return 'removed';
    case 'create-old-link':
      deps.links.createLink(at, step.target, step.kind);
      return 'recreated';
    case 'switch-back':
      switchBack(deps, at, step.target, step.kind);
      return 'switched-back';
    case 'copy-back':
      return copyBack(deps, item, step.removeLinkFirst);
    case 'restore-file':
      return copyBack(deps, item, false);
  }
}

// Performs one step; returns the record of what happened.
function perform(deps: StateDeps, item: Resolved, step: RestoreStep): RestoreRecord {
  const { path: where } = item.operation;
  if (step.action === 'leave') return { path: where, action: 'left', why: step.why };
  const action = change(deps, item, step);
  return action === undefined
    ? { path: where, action: 'left', why: 'its backup is missing, so it cannot be put back' }
    : { path: where, action };
}

function resolveAll(deps: StateDeps, operations: readonly JournalOperation[]): Result<Resolved[], RestoreFailure> {
  const resolved: Resolved[] = [];
  for (const operation of operations) {
    const at = containIn(deps, operation.path, 'keep-link');
    if (!at.ok) return refuse({ kind: 'outside', reason: at.error.reason });
    const backupPath = backupOf(operation);
    const backup = backupPath === undefined ? undefined : containIn(deps, backupPath, 'follow-link');
    if (backup !== undefined && !backup.ok) return refuse({ kind: 'outside', reason: backup.error.reason });
    resolved.push({ operation, at: at.value, backup: backup?.value });
  }
  return succeed(resolved);
}

/**
 * Restores the previous state from the journal of an interrupted run, if there is one.
 *
 * @param deps - the ports and roots
 * @returns `interrupted: false` when there is no journal (or only the journal of a committed run, which is deleted); the report when one was replayed and removed; or why nothing was done
 *   (a journal that cannot be read or points outside the roots is kept, for V to look at)
 */
export function restoreFromJournal(deps: StateDeps): Result<RestoreOutcome, RestoreFailure> {
  const journal = readJournal(deps);
  if (!journal.ok) return refuse({ kind: 'journal', failure: journal.error });
  if (!journal.value.present) return succeed({ interrupted: false, discarded: false });
  // A kill between the commit and the deletion of the journal leaves a journal of a finished run: it is deleted, not replayed.
  const state = readInstallState(deps);
  if (state.ok && state.value.present && isCommitted(journal.value.value, state.value.value.entries)) {
    const discarded = removeJournal(deps);
    return discarded.ok
      ? succeed({ interrupted: false, discarded: true })
      : refuse({ kind: 'journal', failure: discarded.error });
  }
  const resolved = resolveAll(deps, journal.value.value.operations);
  if (!resolved.ok) return resolved;
  const records = [...resolved.value]
    .reverse()
    .map((item) => perform(deps, item, decideRestore(item.operation, observe(deps, item.operation, item.at))));
  const removed = removeJournal(deps);
  if (!removed.ok) return refuse({ kind: 'journal', failure: removed.error });
  return succeed({
    interrupted: true,
    report: { journalPath: path[deps.flavor].join(deps.home, STATE_FILES.journal), records },
  });
}
