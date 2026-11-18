// What the stages of the install and plan pipeline pass between them: the run, and the answer of a stage, which is either a value to go on with
// or the finished output of a run that ends there (exit 10 for a need, exit 1 for a failed check).
import { renderMessage } from '#shared/domain/messages/renderMessage.ts';
import type { StateLogEntry } from '#state/application/StateTypes.ts';
import type { PublicAgentHomeChoice } from '#variables/application/VariablesTypes.ts';
import { buildOutput, noticeText, type Notice } from '#commands/application/install/CommandOutput.ts';
import { reportHome } from '#commands/application/install/HomeStep.ts';
import type {
  CommandOutput,
  CommandsDeps,
  HomeServices,
  InstallRequest,
} from '#commands/application/install/InstallTypes.ts';

/** What a run knows about the home lock it holds (M-12): it can look, renew and say what was lost. */
export interface LockGuard {
  /**
   * Tells whether the lock file still holds this run's text.
   *
   * @returns false when another run took it over after it went stale
   */
  check(): boolean;

  /**
   * Moves the start written in the lock to now by an atomic rewrite, after a prompt or a long fetch.
   *
   * @returns false when the lock was already lost, in which case nothing was rewritten
   */
  refresh(): boolean;

  /**
   * Writes the error of a lost lock, naming the run that holds it now (MG-30).
   *
   * @returns the error notice
   */
  lostNotice(): Notice;
}

/** What a run that took the lock records in `install-log.jsonl` besides its exit code; the finishing stage fills it in (M-16). */
export interface AuditTrail {
  /** The components whose commit changed. */
  components: readonly StateLogEntry['components'][number][];
  /** The keys of the privileged entries approved in this run. */
  approved: readonly string[];
}

/** What every stage of one run shares. */
export interface Run {
  /** The lock this run holds; `plan` takes none. */
  readonly lock: LockGuard | undefined;
  /** What the log line will say about the run. */
  readonly audit: AuditTrail;
  /** The services the commands were given. */
  readonly deps: CommandsDeps;
  /** The command and the update request. */
  readonly request: InstallRequest;
  /** The agent home of the run, confirmed. */
  readonly home: PublicAgentHomeChoice;
  /** The services of that home. */
  readonly services: HomeServices;
}

/** The answer of a stage: a value to go on with, or the output of a run that ends here. */
export type Step<Value> =
  { readonly kind: 'go'; readonly value: Value } | { readonly kind: 'stop'; readonly output: CommandOutput };

/**
 * Wraps the value a stage hands to the next one.
 *
 * @param value - what the next stage needs
 * @returns the step that goes on
 */
export function go<Value>(value: Value): Step<Value> {
  return { kind: 'go', value };
}

/**
 * Wraps the output of a run that ends at this stage.
 *
 * @param output - the finished result
 * @returns the step that stops the pipeline
 */
export function stop(output: CommandOutput): Step<never> {
  return { kind: 'stop', output };
}

/**
 * Lists the printed lines of notices, each with the lines that follow it.
 *
 * @param notices - warnings or errors
 * @returns the lines in order
 */
export function noticeLines(notices: readonly Notice[]): readonly string[] {
  return notices.flatMap(noticeText);
}

/**
 * Builds the output of a run that failed a check (exit 1), with the warnings found before it.
 *
 * @param run - the home, the services and the command of this run
 * @param errors - what failed
 * @param warnings - the warnings printed before the errors
 * @returns the output with status `failed`
 */
export function failedOutput(run: Run, errors: readonly Notice[], warnings: readonly Notice[] = []): CommandOutput {
  const all = [...warnings, ...errors];
  return buildOutput({
    command: run.request.command,
    status: 'failed',
    home: reportHome(run.home),
    body: noticeLines(all),
    notices: all,
  });
}

/**
 * Makes the error of a failure that no check names (MG-38), with the cause on the line under it.
 *
 * @param what - what failed, a short clause
 * @param cause - what the system said, when it said something
 * @param check - the short id of the failure, for `--json`
 * @returns the error notice
 */
export function plainFailure(what: string, cause: string | undefined, check: string): Notice {
  return {
    severity: 'error',
    check,
    item: what,
    line: renderMessage('MG-38', { what }),
    ...(cause === undefined ? {} : { more: [renderMessage('MG-38.cause', { cause })] }),
  };
}

/**
 * Renews the lock after a long wait and says whether the run may go on.
 *
 * @param run - the run
 * @returns the output of a run that lost its lock (exit 1, nothing written), or `undefined` while the lock is still this run's
 */
export function lockLost(run: Run): CommandOutput | undefined {
  if (run.lock === undefined || run.lock.refresh()) return undefined;
  return failedOutput(run, [run.lock.lostNotice()]);
}
