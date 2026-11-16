// `install-log.jsonl` (M-16, C-4): one line per run, append-only, rotated at 1 MiB to `install-log.jsonl.1`. The entry type has no
// field for a variable value, so a value cannot be logged by mistake; every string is made printable (redacted, controls escaped)
// before it is written, so one entry is always one line.
import { canonicalJson } from '#shared/domain/hash/canonicalJson.ts';
import { redactDeep } from '#shared/domain/redaction/redactDeep.ts';

/** The log is rotated when it reaches this many bytes. */
export const LOG_ROTATE_BYTES = 1_048_576;

/** What happened to one component in a run. */
export interface LogComponent {
  /** The component name. */
  readonly name: string;
  /** Its source as the list gives it; redacted again when written. */
  readonly source: string;
  /** The commit before the run, `none` when it was not installed, or `live`. */
  readonly commit_before: string;
  /** The commit after the run, or `live`. */
  readonly commit_after: string;
}

/** One line of the log. */
export interface LogEntry {
  /** The instant of the Clock. */
  readonly time: string;
  /** The command. */
  readonly command: string;
  /** The exit code. */
  readonly exit: number;
  /** The components the run changed. */
  readonly components: readonly LogComponent[];
  /** The ids of the privileged entries approved in this run. */
  readonly approved_privileged: readonly string[];
}

/**
 * Writes one log line: canonical JSON with every string redacted and control characters escaped, ending in a line feed.
 *
 * @param entry - what the run did
 * @returns the line to append
 */
export function emitLogLine(entry: LogEntry): string {
  return `${canonicalJson(redactDeep(entry))}\n`;
}

/**
 * Tells whether the log must be rotated before the next line is appended.
 *
 * @param sizeBytes - the size of the current log
 * @returns true at 1 MiB and above
 */
export function mustRotateLog(sizeBytes: number): boolean {
  return sizeBytes >= LOG_ROTATE_BYTES;
}
