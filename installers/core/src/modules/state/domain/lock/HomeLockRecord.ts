// M-12: the home-wide `install.lock`. One JSON line `{"command", "pid", "started"}`; stale after 10 minutes against the clock, the pid
// being informative only (installer-cli.md MG-30). Pure: the file is read by the HomeLockStore port and the time comes from the Clock.

/** The content of `install.lock`. */
export interface LockRecord {
  /** The command that took the lock, printed in MG-30 (escaped by the message catalogue). */
  readonly command: string;
  /** The process id of the holder; informative only, never used to decide staleness. */
  readonly pid: number;
  /** When the holder took the lock, as an ISO 8601 instant of the Clock. */
  readonly started: string;
}

/** A lock older than this many milliseconds is taken over (10 minutes). */
export const STALE_AFTER_MS = 600_000;

const MAX_LOCK_TEXT = 4096;
const MAX_COMMAND_LENGTH = 64;
const MAX_INSTANT_LENGTH = 40;

/**
 * Writes the text of a lock file: one JSON line with sorted keys.
 *
 * @param record - the holder
 * @returns the file text, ending in a line feed
 */
export function emitLockText(record: LockRecord): string {
  return `${JSON.stringify({ command: record.command, pid: record.pid, started: record.started })}\n`;
}

const isCommand = (value: unknown): value is string =>
  typeof value === 'string' && value.length >= 1 && value.length <= MAX_COMMAND_LENGTH;
const isPid = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const isInstant = (value: unknown): value is string =>
  typeof value === 'string' && value.length <= MAX_INSTANT_LENGTH && !Number.isNaN(Date.parse(value));

/**
 * Parses the one JSON line of `install.lock` into the holder it names.
 *
 * @param text - the file text
 * @returns the record, or `undefined` when the text is not a lock file written by an installer (too long, not JSON, wrong types)
 */
export function parseLockText(text: string): LockRecord | undefined {
  if (text.length > MAX_LOCK_TEXT) return undefined;
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    // Not JSON is the finding itself: the caller treats the file as an unreadable lock.
    return undefined;
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return undefined;
  const { command, pid, started } = raw as Record<string, unknown>;
  return isCommand(command) && isPid(pid) && isInstant(started) ? { command, pid, started } : undefined;
}

/** What a run finds when it looks at the lock file. */
export interface LockAssessment {
  /** `stale`: take it over. `held`: another run owns it. */
  readonly verdict: 'stale' | 'held';
  /** The holder as MG-30 prints it: for a file that is not a lock, the command `unknown` and the file's own time. */
  readonly holder: LockRecord;
}

/**
 * Decides whether a lock file that exists is stale.
 *
 * Older than 10 minutes is stale; so is a lock that claims to start more than 10 minutes in the future (it cannot be a real
 * holder, and a hostile date must not hold the lock for ever). A file that is not a lock record is judged by its modification time.
 *
 * @param text - the file text
 * @param modifiedMs - the file's modification time in milliseconds since the epoch
 * @param now - the instant of the Clock
 * @returns the verdict and the holder to print
 */
export function assessLock(text: string, modifiedMs: number, now: Date): LockAssessment {
  const record = parseLockText(text);
  const holder: LockRecord = record ?? { command: 'unknown', pid: 0, started: new Date(modifiedMs).toISOString() };
  const ageMs = now.getTime() - Date.parse(holder.started);
  const stale = ageMs > STALE_AFTER_MS || ageMs < -STALE_AFTER_MS;
  return { verdict: stale ? 'stale' : 'held', holder };
}
