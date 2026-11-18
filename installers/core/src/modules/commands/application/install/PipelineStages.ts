// The stages of the install and plan pipeline before anything is written: what the last run left, the read and resolve steps with the needs
// of V, and the plan. Each stage returns a value to go on with or the finished output of a run that ends there (exit 10 or exit 1).
import { renderMessage } from '#shared/domain/messages/renderMessage.ts';
import type { ReportChange } from '#shared/domain/report/InstallReport.ts';
import { planVariablesFiles } from '#rendering/application/generated/planVariablesFiles.ts';
import type { Placed } from '#resolution/application/ResolutionTypes.ts';
import type { StateComponentsLock, StateInstallState } from '#state/application/StateTypes.ts';
import { buildInstallPlan, type BuiltPlan } from '#commands/application/install/BuildPlan.ts';
import { buildOutput, type Notice, type PlannedNeed } from '#commands/application/install/CommandOutput.ts';
import { reportHome } from '#commands/application/install/HomeStep.ts';
import { componentNeeds, privilegedNeeds, variableNeeds } from '#commands/application/install/NeedBlocks.ts';
import {
  failedOutput,
  go,
  lockLost,
  noticeLines,
  plainFailure,
  stop,
  type Run,
  type Step,
} from '#commands/application/install/PipelineTypes.ts';
import { installedComponents, type InstalledComponent } from '#commands/application/install/PlanInstall.ts';
import { checkConsent, type ConsentOutcome } from '#commands/application/install/PrivilegedStep.ts';
import { readComponents, type ReadOutcome } from '#commands/application/install/ReadComponents.ts';
import type { ResolveOutcome } from '#commands/application/install/ResolveComponents.ts';
import { settleComponents } from '#commands/application/install/SettleComponents.ts';
import { checkVariables, type VariablesOutcome } from '#commands/application/install/VariablesStep.ts';
import { checkableComponents, validateStaged } from '#commands/application/install/ValidateStaged.ts';
import { changesOf } from '#commands/application/install/ReportChanges.ts';

/** What the last run left in the home. */
export interface Prior {
  /** The install state of the last run, if there is one. */
  readonly previous: StateInstallState | undefined;
  /** The lock of the last run, if there is one. */
  readonly lock: StateComponentsLock | undefined;
}

/** What reading and resolving found, when nothing failed. */
export interface Gathered {
  /** The lists, slots and components that were read. */
  readonly read: ReadOutcome;
  /** The answer of the resolver: `resolved` or `needs`. */
  readonly resolved: Exclude<ResolveOutcome, { kind: 'failed' }>;
  /** The warnings of the run so far, in print order. */
  readonly warnings: readonly Notice[];
  /** The errors of the components that failed and were put back or left out (DR-418); any of them makes the run exit 1. */
  readonly failures: readonly Notice[];
  /** The components that failed, were installed before and stay exactly as they are. */
  readonly frozen: readonly string[];
  /** The components the variables and the consent are computed for. */
  readonly enabled: readonly Placed[];
  /** The declarations, V's values and the variables with no value. */
  readonly variables: Extract<VariablesOutcome, { kind: 'ok' }>;
  /** The privileged set and what in it V has not approved. */
  readonly consent: Extract<ConsentOutcome, { kind: 'checked' }>;
}

/**
 * Reads the lock and the install state the last run left.
 *
 * @param run - the home, the services and the command of this run
 * @param before - the warnings found before this stage, such as an interrupted run that was restored
 * @returns the lock and state, or the failure when either cannot be read (a newer major is never rewritten, DR-205)
 */
export function loadPrior(run: Run, before: readonly Notice[]): Step<Prior> {
  const lock = run.services.state.readComponentsLock();
  const state = run.services.state.readInstallState();
  if (!lock.ok || !state.ok) {
    const error = plainFailure('the state files of the last run cannot be read', undefined, 'state');
    return stop(failedOutput(run, [error], before));
  }
  return go({
    previous: state.value.present ? state.value.value : undefined,
    lock: lock.value.present ? lock.value.value : undefined,
  });
}

// The components that count when the resolver found needs: the ones that were read and not skipped, and agent-config itself.
function enabledPlaced(read: ReadOutcome, resolved: Exclude<ResolveOutcome, { kind: 'failed' }>): readonly Placed[] {
  if (resolved.kind === 'resolved') return resolved.install;
  const skipped = new Set(resolved.warnings.map((warning) => warning.item));
  const core: Placed[] =
    read.core === undefined
      ? []
      : [
          {
            name: read.core.manifest.name,
            slot: 'core',
            origin: 'core',
            source: undefined,
            manifest: read.core.manifest,
          },
        ];
  const listed = read.loaded
    .filter((one) => !skipped.has(one.name))
    .map((one): Placed => ({
      name: one.name,
      slot: one.manifest.slot,
      origin: one.entry.origin,
      source: one.entry.source,
      manifest: one.manifest,
    }));
  return [...core, ...listed];
}

/**
 * Reads the lists and every component, resolves them by slot, and checks the variables and the privileged set of what would be installed.
 *
 * @param run - the home, the services and the command of this run
 * @param prior - what the last run left
 * @param before - the warnings found before this stage
 * @returns what was found, or the failed output of a run that cannot go on
 */
export async function gather(run: Run, prior: Prior, before: readonly Notice[]): Promise<Step<Gathered>> {
  const { deps, home } = run;
  const read = await readComponents({
    deps,
    home,
    command: run.request.command,
    update: run.request.update,
    lock: prior.lock,
  });
  if (read.errors.length > 0) return stop(failedOutput(run, read.errors, [...before, ...read.warnings]));
  const settled = settleComponents(deps, read, {
    home: home.path,
    lock: prior.lock,
    installedBefore: prior.previous?.components ?? {},
  });
  const { resolved, failures, frozen } = settled;
  const warnings = [...before, ...read.warnings, ...resolved.warnings];
  if (resolved.kind === 'failed') return stop(failedOutput(run, [...failures, ...resolved.errors], warnings));
  const enabled = enabledPlaced(settled.read, resolved);
  const variables = await checkVariables(
    deps,
    run.services,
    home.path,
    enabled.map((one) => one.manifest),
  );
  if (variables.kind === 'failed') return stop(failedOutput(run, variables.errors, warnings));
  const consent = checkConsent(deps, enabled, settled.read.loaded, prior.previous, home.path);
  if (consent.kind === 'refused') return stop(failedOutput(run, [...failures, ...consent.errors], warnings));
  return go({ read: settled.read, resolved, warnings, failures, frozen, enabled, variables, consent });
}

// The question V answers holds every privileged block that will be approved, in full, before the question itself: V approves exactly
// the set that was shown, and a terminal that prints only the question still shows it (M-01, AC-4.6). The terminal prints it on its own
// device, never on standard output, so `--json` keeps standard output a single document.
async function approved(run: Run, shown: readonly PlannedNeed[]): Promise<boolean> {
  const blocks = shown.flatMap((one, index) => one.lines(index + 1));
  const question = [...blocks, renderMessage('MG-11.privileged', {})].join('\n');
  try {
    const answer = await run.deps.terminal.ask(question);
    return answer.trim().toLowerCase() === 'yes';
  } catch {
    // No answer is no consent (M-11).
    return false;
  }
}

/**
 * Turns what V must supply into the report of exit 10, or into an approval that lets the run go on.
 *
 * Needs are ordered components, variables, privileged. V is asked to approve privileged changes only at an interactive terminal, only for
 * `install`, and only when nothing else is outstanding; any answer but `yes` leaves the need in the report (M-11, AC-4.6, AC-4.7).
 *
 * @param run - the home, the services and the command of this run
 * @param gathered - what the read and resolve stages found
 * @returns the keys of the privileged entries approved in this run, or the output with the needs
 */
export async function askNeeds(run: Run, gathered: Gathered): Promise<Step<readonly string[]>> {
  const { deps } = run;
  const { resolved, variables, consent } = gathered;
  const others: readonly PlannedNeed[] = [
    ...(resolved.kind === 'needs' ? componentNeeds(resolved.needs) : []),
    ...variableNeeds(variables.needs),
  ];
  const pending = consent.check.diff.pending;
  const privileged = privilegedNeeds(pending, deps.wiring, deps.terminal.interactive);
  if (others.length === 0 && privileged.length === 0) return go([]);
  const mayAsk = others.length === 0 && run.request.command === 'install' && deps.terminal.interactive;
  if (mayAsk && (await approved(run, privileged))) {
    return lockLost(run) === undefined
      ? go(pending.map(({ entry }) => entry.key))
      : stop(lockLost(run) as CommandOutput);
  }
  const output = buildOutput({
    command: run.request.command,
    status: 'needs-input',
    home: reportHome(run.home),
    body: noticeLines([...gathered.warnings, ...gathered.failures]),
    notices: [...gathered.warnings, ...gathered.failures],
    needs: [...others, ...privileged],
  });
  return stop(output);
}

/** The plan of the run with what it is made from. */
export interface Planned {
  /** The components to install, with their folders. */
  readonly components: readonly InstalledComponent[];
  /** The operations and what goes with them. */
  readonly built: BuiltPlan;
  /** The changes the report lists. */
  readonly changes: readonly ReportChange[];
}

function rowNotice(violation: { readonly name: string; readonly column: 'value' | 'description' }): Notice {
  const line =
    violation.column === 'value'
      ? renderMessage('MG-42', { name: violation.name, reason: 'it contains credential-like text' })
      : renderMessage('MG-47', { name: 'a component', variable: violation.name });
  return { severity: 'error', check: 'variable-text', item: violation.name, line };
}

/**
 * Builds the plan: the generated files, the links, the removals and the checks of the trees that will be linked.
 *
 * @param run - the home, the services and the command of this run
 * @param gathered - what the read and resolve stages found
 * @param prior - what the last run left
 * @returns the plan, or the failed output when a check fails or a cell would print credential-like text
 */
export function planStage(run: Run, gathered: Gathered, prior: Prior): Step<Planned> {
  const { deps, home } = run;
  const { read, resolved, variables } = gathered;
  const install = resolved.kind === 'resolved' ? resolved.install : [];
  const components = installedComponents(install, read.loaded, {
    home: home.path,
    repoRoot: deps.environment.repoRoot,
    flavor: deps.environment.flavor,
  });
  const files = planVariablesFiles({ home: home.path, declared: variables.declared, values: variables.values });
  if (!files.ok) return stop(failedOutput(run, files.error.map(rowNotice), gathered.warnings));
  const built = buildInstallPlan({
    deps,
    home: home.path,
    slots: read.slots,
    components,
    files: files.value,
    previous: prior.previous,
    frozen: gathered.frozen,
  });
  if (!('plan' in built)) return stop(failedOutput(run, built, gathered.warnings));
  // The trees are checked now, too, so a run that changes no link still fails on a manifest or an export that went bad (AC-7.2).
  const failures = validateStaged(deps, read.slots, checkableComponents(deps, components));
  if (failures.length > 0) return stop(failedOutput(run, failures, gathered.warnings));
  return go({ components, built, changes: changesOf(built) });
}
