// The journal `install-state.pending.json` (DR-202 steps 7 to 9, data-model.md): the plan's link and write operations with what each
// path held before, written (temp file, then rename) before the first switch and deleted at the commit point. If a run dies in
// between, the next `install` or `doctor` replays it backwards and every path is as it was.
//
// RESTORE RULES (what `decideRestore` implements, one operation at a time, last operation first, each safe to run twice):
//   link, old = absent        our link there  -> remove the link;  nothing there -> nothing;  anything else -> leave it
//   link, old = a link        our link there  -> switch back;  nothing there (killed between remove and create) -> create the old
//                             link;  the old link there -> nothing;  anything else -> leave it
//   link, old = backed up     our link there  -> remove it and copy the backup back;  nothing there -> copy the backup back;
//                             the real entry there -> nothing
//   write, old = absent       our content there (hash equal) -> remove it;  other content (V edited it) -> leave it
//   write, old = a file       our content there -> copy the backup back;  nothing there -> copy the backup back;  other -> leave it
// The journal file is removed last, so a crash during a restore replays the rest on the next run.
import { canonicalJson } from '#shared/domain/hash/canonicalJson.ts';
import { refuse, succeed, type Result } from '#shared/domain/result/Result.ts';

/** The file schema this installer writes and reads. */
export const JOURNAL_SCHEMA = 'install-journal/v1';

/** What a link path held before the run. */
export type OldLink =
  | { readonly state: 'absent' }
  | { readonly state: 'link'; readonly target: string; readonly kind: 'symlink' | 'junction' }
  | { readonly state: 'backed-up'; readonly backup: string };

/** What a written file held before the run. */
export type OldFile = { readonly state: 'absent' } | { readonly state: 'file'; readonly backup: string };

/** One journaled operation. */
export type JournalOperation =
  | {
      readonly op: 'link';
      /** The absolute path of the link. */
      readonly path: string;
      /** The kind the run asks for; the Windows ladder may place a lower one. */
      readonly kind: 'symlink' | 'junction';
      /** Where the link must point. */
      readonly target: string;
      /** What the path held before. */
      readonly old: OldLink;
    }
  | {
      readonly op: 'write';
      /** The absolute path of the file. */
      readonly path: string;
      /** The SHA-256 of the content the run writes. */
      readonly hash: string;
      /** What the path held before. */
      readonly old: OldFile;
    };

/** The journal of one run. */
export interface Journal {
  /** The agent home of the run. */
  readonly home: string;
  /** The command that wrote it. */
  readonly command: string;
  /** When it was written. */
  readonly started: string;
  /** Operations in the order the run performs them. */
  readonly operations: readonly JournalOperation[];
}

const MAX_OPERATIONS = 50_000;
const MAX_TEXT = 4096;
const SHA256 = /^[0-9a-f]{64}$/;

type Raw = Readonly<Record<string, unknown>>;

function isRaw(value: unknown): value is Raw {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isText(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= MAX_TEXT && value.isWellFormed();
}

function isOldLink(value: unknown): value is OldLink {
  if (!isRaw(value)) return false;
  if (value['state'] === 'absent') return true;
  if (value['state'] === 'link')
    return isText(value['target']) && (value['kind'] === 'symlink' || value['kind'] === 'junction');
  return value['state'] === 'backed-up' && isText(value['backup']);
}

function isOldFile(value: unknown): value is OldFile {
  return isRaw(value) && (value['state'] === 'absent' || (value['state'] === 'file' && isText(value['backup'])));
}

function isOperation(value: unknown): value is JournalOperation {
  if (!isRaw(value) || !isText(value['path'])) return false;
  if (value['op'] === 'link') {
    return (
      (value['kind'] === 'symlink' || value['kind'] === 'junction') &&
      isText(value['target']) &&
      isOldLink(value['old'])
    );
  }
  return (
    value['op'] === 'write' &&
    typeof value['hash'] === 'string' &&
    SHA256.test(value['hash']) &&
    isOldFile(value['old'])
  );
}

/**
 * Reads the text of the journal; every field of every operation is checked, because the file is on disk and could have been edited.
 *
 * @param text - the file text
 * @returns the journal, or the sentence that says why it cannot be replayed (it never quotes the file)
 */
export function parseJournal(text: string): Result<Journal, string> {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    // The text is not JSON (a damaged file): reported as unreadable, without quoting it.
    return refuse('the journal is not valid JSON');
  }
  if (!isRaw(raw) || raw['schema'] !== JOURNAL_SCHEMA) return refuse('the journal is not an install-journal/v1 file');
  const operations = raw['operations'];
  if (!isText(raw['home']) || !isText(raw['command']) || !isText(raw['started']))
    return refuse('the journal has a field that is missing');
  if (!Array.isArray(operations) || operations.length > MAX_OPERATIONS || !operations.every(isOperation)) {
    return refuse('the journal has an operation that is not valid');
  }
  return succeed({ home: raw['home'], command: raw['command'], started: raw['started'], operations });
}

/**
 * Writes the text of the journal: JSON, keys sorted, ending in a line feed.
 *
 * @param journal - the journal to write
 * @returns the file text
 */
export function emitJournal(journal: Journal): string {
  const sorted: unknown = JSON.parse(canonicalJson({ ...journal, schema: JOURNAL_SCHEMA }));
  return `${JSON.stringify(sorted, null, 2)}\n`;
}

/** What is at an operation's path now. */
export type Observed =
  | { readonly kind: 'absent' }
  | { readonly kind: 'link'; readonly target: string }
  | { readonly kind: 'file'; readonly hash: string }
  | { readonly kind: 'folder' | 'other' };

/** One step of a restore. */
export type RestoreStep =
  | { readonly action: 'nothing' }
  | { readonly action: 'leave'; readonly why: string }
  | { readonly action: 'remove-link' }
  | { readonly action: 'switch-back'; readonly target: string; readonly kind: 'symlink' | 'junction' }
  | { readonly action: 'create-old-link'; readonly target: string; readonly kind: 'symlink' | 'junction' }
  | { readonly action: 'copy-back'; readonly backup: string; readonly removeLinkFirst: boolean }
  | { readonly action: 'remove-file' }
  | { readonly action: 'restore-file'; readonly backup: string };

const NOT_OURS = 'it is not what this run placed, so it is left as it is';

type LinkOperation = Extract<JournalOperation, { op: 'link' }>;

const isOurs = (operation: LinkOperation, observed: Observed): boolean =>
  observed.kind === 'link' && observed.target === operation.target;

function restoreOverAbsent(operation: LinkOperation, observed: Observed): RestoreStep {
  if (observed.kind === 'absent') return { action: 'nothing' };
  return isOurs(operation, observed) ? { action: 'remove-link' } : { action: 'leave', why: NOT_OURS };
}

function restoreOverLink(
  operation: LinkOperation,
  old: Extract<OldLink, { state: 'link' }>,
  observed: Observed,
): RestoreStep {
  if (observed.kind === 'absent') return { action: 'create-old-link', target: old.target, kind: old.kind };
  if (observed.kind === 'link' && observed.target === old.target) return { action: 'nothing' };
  return isOurs(operation, observed)
    ? { action: 'switch-back', target: old.target, kind: old.kind }
    : { action: 'leave', why: NOT_OURS };
}

function restoreOverBackedUp(
  operation: LinkOperation,
  old: Extract<OldLink, { state: 'backed-up' }>,
  observed: Observed,
): RestoreStep {
  if (observed.kind === 'absent') return { action: 'copy-back', backup: old.backup, removeLinkFirst: false };
  if (isOurs(operation, observed)) return { action: 'copy-back', backup: old.backup, removeLinkFirst: true };
  return observed.kind === 'link' ? { action: 'leave', why: NOT_OURS } : { action: 'nothing' };
}

function decideLinkRestore(operation: LinkOperation, observed: Observed): RestoreStep {
  const { old } = operation;
  if (old.state === 'absent') return restoreOverAbsent(operation, observed);
  return old.state === 'link'
    ? restoreOverLink(operation, old, observed)
    : restoreOverBackedUp(operation, old, observed);
}

function decideWriteRestore(operation: Extract<JournalOperation, { op: 'write' }>, observed: Observed): RestoreStep {
  const { old } = operation;
  if (observed.kind === 'absent') {
    return old.state === 'file' ? { action: 'restore-file', backup: old.backup } : { action: 'nothing' };
  }
  if (observed.kind !== 'file' || observed.hash !== operation.hash) {
    return { action: 'leave', why: 'its content is not what this run wrote, so it is left as it is' };
  }
  return old.state === 'file' ? { action: 'restore-file', backup: old.backup } : { action: 'remove-file' };
}

/**
 * Decides what undoing one journaled operation takes, from what is at its path now.
 *
 * @param operation - the journaled operation
 * @param observed - what the path holds now
 * @returns the step to perform; `leave` for anything the run did not place
 */
export function decideRestore(operation: JournalOperation, observed: Observed): RestoreStep {
  return operation.op === 'link' ? decideLinkRestore(operation, observed) : decideWriteRestore(operation, observed);
}

/**
 * Tells whether a journal belongs to a run that already committed: `install-state.json` lists every journaled path with the target (a
 * link) or hash (a write) the journal names. A kill between the state file's rename and the journal's deletion leaves exactly this,
 * and replaying such a journal would undo a finished run. A journal with no operation is trivially committed.
 *
 * @param journal - the journal found on disk
 * @param entries - the entries of the current `install-state.json`
 * @returns true when nothing is left to undo
 */
export function isCommitted(
  journal: Journal,
  entries: readonly { readonly path: string; readonly target?: string; readonly hash?: string }[],
): boolean {
  return journal.operations.every((operation) =>
    entries.some(
      (entry) =>
        entry.path === operation.path &&
        (operation.op === 'link' ? entry.target === operation.target : entry.hash === operation.hash),
    ),
  );
}
