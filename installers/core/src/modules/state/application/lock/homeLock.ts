// M-12, MG-30: the home-wide lock. `install` and `uninstall` wait for it at most 2 seconds; `rerender` only tries. It is released at
// the end of every run by the command's own `finally`, never by an exit handler: a killed run leaves it, and it goes stale after 10
// minutes (the pid is informative only).
import { assessLock, emitLockText, type LockRecord } from '#state/domain/lock/HomeLockRecord.ts';
import { refuse, succeed, type Result } from '#shared/domain/result/Result.ts';
import type { Clock } from '#state/application/ports/Clock.ts';
import type { HomeLockStore } from '#state/application/ports/HomeLockStore.ts';

/** The ports the lock needs. */
export interface LockDeps {
  /** The lock file. */
  readonly lock: HomeLockStore;
  /** The clock. */
  readonly clock: Clock;
}

/** What the caller gives the lock. */
export interface LockRequest {
  /** The command taking the lock, written into the file. */
  readonly command: string;
  /** The process id, written into the file. */
  readonly pid: number;
  /** `wait`: poll for 2 seconds (install, uninstall). `try`: one attempt (rerender). */
  readonly mode: 'wait' | 'try';
}

/** What a run holds while it owns the lock. */
export interface HomeLockHandle {
  /** The lock file path, for messages. */
  readonly path: string;
  /** The exact text written, so release removes only this lock. */
  readonly text: string;
}

/** Why the lock was not taken. */
export type LockRefusal =
  | { readonly kind: 'held'; readonly path: string; readonly holder: LockRecord }
  | { readonly kind: 'unusable'; readonly path: string; readonly why: 'is-link' | 'unreadable' };

/** How many times a waiting run looks (20 looks, 100 ms apart, about 2 seconds). */
export const WAIT_ATTEMPTS = 20;

/** The pause between two looks, in milliseconds. */
export const WAIT_STEP_MS = 100;

// One attempt: create the lock; if it exists, take it over when stale, else report the holder.
function attempt(deps: LockDeps, text: string): Result<HomeLockHandle, LockRefusal> {
  const { lock, clock } = deps;
  if (lock.tryCreate(text) === 'created') return succeed({ path: lock.path, text });
  const seen = lock.read();
  if (seen.kind === 'link') return refuse({ kind: 'unusable', path: lock.path, why: 'is-link' });
  if (seen.kind === 'unreadable') return refuse({ kind: 'unusable', path: lock.path, why: 'unreadable' });
  if (seen.kind === 'absent')
    return lock.tryCreate(text) === 'created'
      ? succeed({ path: lock.path, text })
      : refuse({ kind: 'unusable', path: lock.path, why: 'unreadable' });
  const assessment = assessLock(seen.text, seen.modifiedMs, clock.now());
  if (assessment.verdict === 'held') return refuse({ kind: 'held', path: lock.path, holder: assessment.holder });
  // Stale: remove exactly the text that was judged stale, then create again; if another run took it in between, it is held.
  lock.removeIfSame(seen.text);
  if (lock.tryCreate(text) === 'created') return succeed({ path: lock.path, text });
  const again = lock.read();
  return again.kind === 'file'
    ? refuse({ kind: 'held', path: lock.path, holder: assessLock(again.text, again.modifiedMs, clock.now()).holder })
    : refuse({ kind: 'unusable', path: lock.path, why: 'unreadable' });
}

/**
 * Takes the home lock, taking over a stale one.
 *
 * @param deps - the lock file and the clock
 * @param request - the command, the pid and whether to wait
 * @returns the handle to release at the end of the run, or who holds the lock (MG-30), or why the lock file cannot be used
 */
export async function acquireHomeLock(
  deps: LockDeps,
  request: LockRequest,
): Promise<Result<HomeLockHandle, LockRefusal>> {
  const text = emitLockText({ command: request.command, pid: request.pid, started: deps.clock.now().toISOString() });
  const attempts = request.mode === 'wait' ? WAIT_ATTEMPTS : 1;
  let outcome = attempt(deps, text);
  for (let tried = 1; tried < attempts && !outcome.ok && outcome.error.kind === 'held'; tried += 1) {
    await deps.clock.sleep(WAIT_STEP_MS);
    outcome = attempt(deps, text);
  }
  return outcome;
}

/**
 * Releases the lock this run took; a lock another run took in the meantime is left alone.
 *
 * @param deps - the lock file and the clock
 * @param handle - what `acquireHomeLock` returned
 * @returns `removed`, `changed` (another run's lock, left alone) or `absent`
 */
export function releaseHomeLock(deps: LockDeps, handle: HomeLockHandle): 'removed' | 'changed' | 'absent' {
  return deps.lock.removeIfSame(handle.text);
}
