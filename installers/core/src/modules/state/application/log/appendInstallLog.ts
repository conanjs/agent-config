// M-16, C-4: append one line per run to `install-log.jsonl` (owner-only), rotating a log of 1 MiB or more to `install-log.jsonl.1`
// first. The previous file is replaced; only one is kept. No variable value is part of an entry.
import path from 'node:path';
import { refuse, succeed, type Result } from '#shared/domain/result/Result.ts';
import { emitLogLine, mustRotateLog, type LogEntry } from '#state/domain/log/InstallLog.ts';
import { containIn } from '#state/application/files/containIn.ts';
import type { StateDeps } from '#state/application/StateDeps.ts';

/** The log file name inside the home. */
export const LOG_FILE = 'install-log.jsonl';

/**
 * Adds this run's line to `install-log.jsonl`, first moving a log of 1 MiB or more to `install-log.jsonl.1`.
 *
 * @param deps - the ports and roots
 * @param entry - what the run did
 * @returns `appended` or `rotated-and-appended`, or why the log path was refused (a link or a folder is never written through)
 */
export function appendInstallLog(
  deps: StateDeps,
  entry: LogEntry,
): Result<'appended' | 'rotated-and-appended', string> {
  const flavored = path[deps.flavor];
  const log = containIn(deps, flavored.join(deps.home, LOG_FILE), 'keep-link');
  const previous = containIn(deps, flavored.join(deps.home, `${LOG_FILE}.1`), 'keep-link');
  if (!log.ok) return refuse(log.error.reason);
  if (!previous.ok) return refuse(previous.error.reason);
  const found = deps.fs.stat(log.value);
  if (found !== undefined && found.kind !== 'file') return refuse('the log path is not a regular file');
  const rotate = found !== undefined && mustRotateLog(found.size);
  if (rotate) deps.fs.rename(log.value, previous.value);
  deps.fs.appendFile(log.value, emitLogLine(entry));
  return succeed(rotate ? 'rotated-and-appended' : 'appended');
}
