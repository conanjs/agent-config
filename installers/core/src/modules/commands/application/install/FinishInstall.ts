// The last stages of the pipeline: `plan` prints what `install` would change; `install` says "no changes" when the plan, the lock and the
// state are the same as the last run's, and otherwise applies the plan (which writes `components.lock` and `install-state.json` only as its
// last step). A run that got this far appends one line to `install-log.jsonl` (M-16).
import { renderMessage } from '#shared/domain/messages/renderMessage.ts';
import type { StateComponentsLock, StateInstallState } from '#state/application/StateTypes.ts';
import { applyInstall } from '#commands/application/install/ApplyInstall.ts';
import { buildOutput, type Notice } from '#commands/application/install/CommandOutput.ts';
import { reportHome } from '#commands/application/install/HomeStep.ts';
import type { CommandOutput } from '#commands/application/install/InstallTypes.ts';
import { noticeLines, type Run } from '#commands/application/install/PipelineTypes.ts';
import type { Gathered, Planned, Prior } from '#commands/application/install/PipelineStages.ts';
import { CORE_COMPONENT_NAME } from '#commands/application/install/ReadComponents.ts';
import { wouldLines } from '#commands/application/install/ReportChanges.ts';
import { planChangesDisk } from '#commands/application/install/PlanInstall.ts';
import {
  buildInstallState,
  buildLock,
  buildLogEntry,
  sameLock,
  sameState,
  type RunRecord,
} from '#commands/application/install/StateRecords.ts';

/** Everything the last stages need. */
export interface Finish {
  /** The run. */
  readonly run: Run;
  /** What the read and resolve stages found. */
  readonly gathered: Gathered;
  /** The plan. */
  readonly planned: Planned;
  /** What the last run left. */
  readonly prior: Prior;
  /** The keys of the privileged entries V approved in this run. */
  readonly approvedKeys: readonly string[];
}

type KindMap = ReadonlyMap<string, 'symlink' | 'junction' | 'copy'>;

function recordOf(input: Finish, kinds: KindMap): RunRecord {
  const { run, gathered, planned, prior } = input;
  return {
    home: run.home.path,
    installer: run.deps.environment.installer,
    time: run.deps.clock.now().toISOString(),
    components: planned.components,
    loaded: gathered.read.loaded,
    plan: planned.built.plan,
    carried: planned.built.carried,
    placedKinds: kinds,
    previous: prior.previous,
    frozen: gathered.frozen,
    previousLock: prior.lock,
    consent: gathered.consent.check,
  };
}

function removedNames(previous: StateInstallState | undefined, input: Finish): readonly string[] {
  const now = new Set(input.planned.components.map((one) => one.name));
  const frozen = new Set(input.gathered.frozen);
  return Object.keys(previous?.components ?? {}).filter(
    (name) => name !== CORE_COMPONENT_NAME && !now.has(name) && !frozen.has(name),
  );
}

function appendLog(input: Finish, exit: number): void {
  const entry = buildLogEntry(recordOf(input, new Map()), { command: 'install', exit }, input.approvedKeys);
  input.run.services.state.appendLog(entry);
}

/**
 * Ends a `plan` run: the changes `install` would make, as `would` lines and as the changes of the report. Nothing is written.
 *
 * @param input - the run, what was found and the plan
 * @returns the output; status `done` when something would change, `no-changes` when nothing would
 */
export function finishPlan(input: Finish): CommandOutput {
  const { run, gathered, planned } = input;
  const changed = planChangesDisk(planned.built.plan) || input.approvedKeys.length > 0;
  const notices = [...gathered.warnings, ...gathered.failures];
  const status = gathered.failures.length > 0 ? 'failed' : changed ? 'done' : 'no-changes';
  return buildOutput({
    command: 'plan',
    status,
    home: reportHome(run.home),
    body: [...gathered.read.progress, ...noticeLines(notices), ...wouldLines(planned.changes)],
    notices,
    changes: planned.changes,
  });
}

function nothingToDo(input: Finish): boolean {
  const record = recordOf(input, new Map());
  const lockSame = sameLock(input.prior.lock, buildLock(record));
  const stateSame = sameState(input.prior.previous, buildInstallState(record, { command: 'install', exit: 0 }));
  return !planChangesDisk(input.planned.built.plan) && input.approvedKeys.length === 0 && lockSame && stateSame;
}

function recordsFor(input: Finish, kinds: KindMap): { lock: StateComponentsLock; state: StateInstallState } {
  const record = recordOf(input, kinds);
  return { lock: buildLock(record), state: buildInstallState(record, { command: 'install', exit: 0 }) };
}

/**
 * Ends an `install` run: reports "no changes", or applies the plan and reports what was done.
 *
 * @param input - the run, what was found and the plan
 * @returns the output; status `no-changes`, `done`, or `failed` with the previous links in place
 */
export function finishInstall(input: Finish): CommandOutput {
  const { run, gathered, planned } = input;
  const home = reportHome(run.home);
  if (nothingToDo(input)) {
    const failed = gathered.failures.length > 0;
    appendLog(input, failed ? 1 : 0);
    const notices = [...gathered.warnings, ...gathered.failures];
    const status = failed ? 'failed' : 'no-changes';
    return buildOutput({ command: 'install', status, home, body: noticeLines(notices), notices });
  }
  const outcome = applyInstall({
    deps: run.deps,
    services: run.services,
    home: run.home.path,
    slots: gathered.read.slots,
    components: planned.components,
    plan: planned.built.plan,
    removedComponents: removedNames(input.prior.previous, input),
    records: (kinds) => recordsFor(input, kinds),
  });
  if (outcome.kind === 'failed') {
    const notices: readonly Notice[] = [...gathered.warnings, ...outcome.errors];
    return buildOutput({
      command: 'install',
      status: 'failed',
      home,
      body: noticeLines(notices),
      notices,
      backup: outcome.backup,
    });
  }
  const failed = gathered.failures.length > 0;
  appendLog(input, failed ? 1 : 0);
  const backupLine = outcome.backup === null ? [] : [renderMessage('MG-18', { path: outcome.backup })];
  const notices = [...gathered.warnings, ...gathered.failures];
  return buildOutput({
    command: 'install',
    status: failed ? 'failed' : 'done',
    home,
    body: [...gathered.read.progress, ...noticeLines(notices), ...planned.built.retiredLines, ...backupLine],
    notices,
    changes: planned.changes,
    backup: outcome.backup,
  });
}
