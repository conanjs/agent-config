// DR-418 option A, the fixed point of the install (AC-3.4, AC-3.5, AC-7.2, AC-10.4): a component that fails to be acquired, or whose new
// version fails a check of its staged tree, goes back to its locked previous version, or is left out when it has none. The cross-checks
// then run again over what is left, until nothing changes, so every component that passes switches in one apply and each failure is
// named in the report (exit 1). The loop itself is `settleResolution` of the resolution module.
import path from 'node:path';
import type { Candidate, Placed } from '#resolution/application/ResolutionTypes.ts';
import { settleResolution } from '#resolution/application/settleResolution.ts';
import type { StateComponentsLock } from '#state/application/StateTypes.ts';
import type { Notice } from '#commands/application/install/CommandOutput.ts';
import type { CommandsDeps } from '#commands/application/install/InstallTypes.ts';
import { installedComponents } from '#commands/application/install/PlanInstall.ts';
import {
  lockedGitOf,
  progressOf,
  type LoadedComponent,
  type ReadOutcome,
} from '#commands/application/install/ReadComponents.ts';
import {
  outcomeOf,
  resolveComponents,
  resolveInputOf,
  type ResolveOutcome,
} from '#commands/application/install/ResolveComponents.ts';
import { checkableComponents, validateStaged } from '#commands/application/install/ValidateStaged.ts';

/** What the fixed point gave. */
export interface Settled {
  /** What was read, with the components that stay: the new versions that pass, the previous versions that came back. */
  readonly read: ReadOutcome;
  /** The resolver's answer over those components. */
  readonly resolved: ResolveOutcome;
  /** The errors of every component that failed, in print order; any of them makes the run exit 1. */
  readonly failures: readonly Notice[];
  /** Components that failed, were installed before and have no previous tree to go back to: their links and records stay as they are. */
  readonly frozen: readonly string[];
}

/** What the fixed point needs besides the components. */
export interface SettleContext {
  /** The agent home, where the store lies. */
  readonly home: string;
  /** The lock of the last run. */
  readonly lock: StateComponentsLock | undefined;
  /** The components of the last install state, name to commit or `live`. */
  readonly installedBefore: Readonly<Record<string, string>>;
}

const candidateOf = (one: LoadedComponent): Candidate => ({
  name: one.name,
  origin: one.entry.origin,
  source: one.entry.source,
  manifest: one.manifest,
});

// The version of each git component that the last run linked, read again from its store tree: the version a failure goes back to.
function previousVersions(
  deps: CommandsDeps,
  read: ReadOutcome,
  context: SettleContext,
): ReadonlyMap<string, LoadedComponent> {
  const found = new Map<string, LoadedComponent>();
  for (const entry of read.entries) {
    const locked = lockedGitOf(context.lock, entry);
    const id = context.lock?.components[entry.name]?.store_id;
    if (locked === undefined || id === undefined || entry.source.type !== 'git') continue;
    const root = path[deps.environment.flavor].join(context.home, 'store', `${entry.name}@${id}`);
    const read1 = deps.manifests.readComponent({
      name: entry.name,
      root,
      slots: read.slots,
      source: { kind: 'clone' },
    });
    if (read1.kind !== 'loaded') continue;
    const git = {
      kind: 'acquired' as const,
      name: entry.name,
      url: entry.source.url,
      ref: entry.source.ref,
      commit: locked.commit,
      tag: locked.tag,
      advancedFrom: undefined,
      submodules: false,
    };
    found.set(entry.name, { name: entry.name, manifest: read1.manifest, sourceRoot: root, entry, git });
  }
  return found;
}

// The staged checks of one resolution: the names that fail, and the first error of each, kept for the report.
function checker(
  deps: CommandsDeps,
  read: ReadOutcome,
  versions: readonly LoadedComponent[],
  context: SettleContext,
  errors: Map<string, readonly Notice[]>,
): (result: { readonly install: readonly Placed[] }) => readonly string[] {
  return (result) => {
    const folders = { home: context.home, repoRoot: deps.environment.repoRoot, flavor: deps.environment.flavor };
    const components = result.install.flatMap((placed) => {
      const pick = versions.find((one) => one.name === placed.name && one.manifest === placed.manifest);
      return installedComponents([placed], pick === undefined ? [] : [pick], folders);
    });
    const notices = validateStaged(deps, read.slots, checkableComponents(deps, components));
    const names = [...new Set(notices.map((one) => one.item))];
    for (const name of names) {
      if (!errors.has(name))
        errors.set(
          name,
          notices.filter((one) => one.item === name),
        );
    }
    return names;
  };
}

/**
 * Runs the fixed point of DR-418 over the components that were read.
 *
 * @param deps - the services the commands were given
 * @param read - what the read step gave, with the components that failed to be acquired
 * @param context - the home, the lock and the components of the last run
 * @returns the components that stay, the resolver's answer over them, the errors of the failures and the components whose links stay as they are
 */
export function settleComponents(deps: CommandsDeps, read: ReadOutcome, context: SettleContext): Settled {
  // 1. A component that failed to be acquired goes back to its previous version when it has one.
  const previous = previousVersions(deps, read, context);
  const back = read.failures.flatMap((failure) => previous.get(failure.name) ?? []);
  const initial = [...read.loaded, ...back];
  const readErrors = read.failures.flatMap((failure) => failure.notices);
  // 2. The cross-checks and the checks of the staged trees run until nothing changes.
  const errors = new Map<string, readonly Notice[]>();
  const versions = [...initial, ...previous.values()];
  const candidates = new Map([...previous].map(([name, one]) => [name, candidateOf(one)] as const));
  const input = resolveInputOf(deps, { ...read, loaded: initial });
  const settled = settleResolution(input, checker(deps, read, versions, context, errors), candidates);
  const untouched = settled.restored.length === 0 && settled.leftOut.length === 0 && back.length === 0;
  const loaded = initial
    .map((one) => (settled.restored.includes(one.name) ? (previous.get(one.name) ?? one) : one))
    .filter((one) => !settled.leftOut.includes(one.name));
  const final: ReadOutcome = {
    ...read,
    loaded,
    progress: [...read.overrides, ...loaded.flatMap(progressOf)],
  };
  const resolved = untouched ? outcomeOf(settled.result) : resolveComponents(deps, final);
  // 3. The failures in print order; a component that stays out and was installed before keeps its links and records.
  const failedNames = new Set([...read.failures.map((failure) => failure.name), ...errors.keys()]);
  const gone = [...failedNames].filter((name) => !loaded.some((one) => one.name === name));
  const frozen = gone.filter((name) => context.installedBefore[name] !== undefined);
  return { read: final, resolved, failures: [...readErrors, ...[...errors.values()].flat()], frozen };
}
