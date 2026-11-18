// The use cases `install` and `plan` (FR-016, DR-306): one pipeline, read → resolve → plan → apply → report. `plan` runs the same steps
// up to the plan and writes nothing; `install` goes on to apply it. Anything V must supply stops the run with exit 10 and nothing
// written: the home first, then components, variables and privileged changes, in that order (FR-018). A failed check exits 1 with the
// previous links in place and neither `components.lock` nor `install-state.json` written.
import { renderMessage } from '#shared/domain/messages/renderMessage.ts';
import type { LockRefusal } from '#state/application/lock/homeLock.ts';
import type { Notice } from '#commands/application/install/CommandOutput.ts';
import { finishInstall, finishPlan } from '#commands/application/install/FinishInstall.ts';
import { resolveHome } from '#commands/application/install/HomeStep.ts';
import type { CommandOutput, CommandsDeps, InstallRequest } from '#commands/application/install/InstallTypes.ts';
import { failedOutput, plainFailure, type Run } from '#commands/application/install/PipelineTypes.ts';
import { askNeeds, gather, loadPrior, planStage } from '#commands/application/install/PipelineStages.ts';

function lockNotice(refusal: LockRefusal): Notice {
  if (refusal.kind === 'held') {
    const line = renderMessage('MG-30', {
      lock: refusal.path,
      command: refusal.holder.command,
      started: refusal.holder.started,
    });
    return { severity: 'error', check: 'lock-held', item: refusal.path, line, more: [renderMessage('MG-30.hint', {})] };
  }
  return plainFailure('the lock file cannot be used', refusal.why, 'lock-unusable');
}

// A journal that a killed run left is replayed before anything else: the previous state comes back, and the run goes on from there (EDGE-4).
function interruptedNotice(journalPath: string): Notice {
  const detail = renderMessage('MG-39.interrupted-install', {});
  const line = renderMessage('MG-39', { severity: 'warning', check: 'interrupted-install', item: journalPath, detail });
  return { severity: 'warning', check: 'interrupted-install', item: journalPath, line };
}

async function pipeline(run: Run, before: readonly Notice[]): Promise<CommandOutput> {
  // 1. What the last run left, then the lists and components, resolved by slot.
  const prior = loadPrior(run, before);
  if (prior.kind === 'stop') return prior.output;
  const gathered = await gather(run, prior.value, before);
  if (gathered.kind === 'stop') return gathered.output;
  // 2. What V must supply or approve; the answer is the privileged entries approved now, or the output of exit 10.
  const asked = await askNeeds(run, gathered.value);
  if (asked.kind === 'stop') return asked.output;
  // 3. The plan, then `plan` prints it and `install` applies it.
  const planned = planStage(run, gathered.value, prior.value);
  if (planned.kind === 'stop') return planned.output;
  const input = {
    run,
    gathered: gathered.value,
    planned: planned.value,
    prior: prior.value,
    approvedKeys: asked.value,
  };
  return run.request.command === 'plan' ? finishPlan(input) : finishInstall(input);
}

/**
 * Runs the `install` or `plan` command from the home choice to the report.
 *
 * `plan` never creates the home, takes the lock or writes. `install` creates the home once V confirmed it, takes the home lock for the whole
 * run, and puts an interrupted run right before it starts; a lock another run holds exits 1 naming it (M-12).
 *
 * @param deps - the services the commands were given
 * @param request - which command, and which sources `--update` advances
 * @returns the report and the lines of text mode; the exit code is in the report
 */
export async function runInstall(deps: CommandsDeps, request: InstallRequest): Promise<CommandOutput> {
  // 1. The agent home, confirmed by V at an interactive terminal or reported as a need.
  const homeStep = await resolveHome(deps, request);
  if (homeStep.kind === 'stop') return homeStep.output;
  const run: Run = { deps, request, home: homeStep.home, services: homeStep.services };
  if (request.command === 'plan') return pipeline(run, []);
  // 2. `install` writes: make the home, take the lock, and put an interrupted run right first.
  const { state } = run.services;
  const created = state.createHome(deps.environment.userHome);
  if (!created.ok) {
    const line = renderMessage('MG-41', { path: run.home.path, reason: created.error.reason });
    return failedOutput(run, [{ severity: 'error', check: 'home-refused', item: run.home.path, line }]);
  }
  const lock = await state.acquireLock({ command: 'install', pid: deps.environment.processId, mode: 'wait' });
  if (!lock.ok) return failedOutput(run, [lockNotice(lock.error)]);
  try {
    const restored = state.restoreFromJournal();
    if (!restored.ok) {
      const error = plainFailure(
        'the journal of an interrupted run cannot be restored',
        restored.error.kind,
        'journal',
      );
      return failedOutput(run, [error]);
    }
    const interrupted = restored.value.interrupted ? [interruptedNotice(restored.value.report.journalPath)] : [];
    return await pipeline(run, interrupted);
  } finally {
    state.releaseLock(lock.value);
  }
}
