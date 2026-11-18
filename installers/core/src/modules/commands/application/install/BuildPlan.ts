// Step "plan" of the pipeline, the part that looks at the disk: the shared folders, the old state of every path the run touches, and
// the text of the generated files. It reads, and never writes; the pure decisions are in PlanInstall.ts, so `plan` and `install` get
// the same answer from the same facts (DR-306, TR-4).
import path from 'node:path';
import { renderMessage } from '#shared/domain/messages/renderMessage.ts';
import type { SlotTable } from '#manifests/application/ManifestTypes.ts';
import type { PlannedGeneratedFile } from '#rendering/application/generated/planVariablesFiles.ts';
import type { StateInstallState, StateInstallStateEntry } from '#state/application/StateTypes.ts';
import type { WiringObservation, WiringRetiredDecision } from '#wiring/application/WiringTypes.ts';
import type { Notice } from '#commands/application/install/CommandOutput.ts';
import type { CommandsDeps } from '#commands/application/install/InstallTypes.ts';
import { checkableComponents } from '#commands/application/install/ValidateStaged.ts';
import {
  mountLinks,
  obsoleteLinks,
  sharedFolders,
  stepFor,
  VARIABLES_LINK,
  writeSteps,
  type Blocked,
  type DesiredLink,
  type InstalledComponent,
  type InstallPlan,
  type LinkStep,
} from '#commands/application/install/PlanInstall.ts';

/** The plan with the extra facts the report and the state need. */
export interface BuiltPlan {
  /** The operations of the run. */
  readonly plan: InstallPlan;
  /** The MG-19 lines of the retired list, in list order. */
  readonly retiredLines: readonly string[];
  /** The entries of the last run that stay recorded without a new operation: unchanged compatibility links and retired links that are kept. */
  readonly carried: readonly StateInstallStateEntry[];
}

/** What the plan is built from. */
export interface PlanContext {
  /** The services the commands were given. */
  readonly deps: CommandsDeps;
  /** The agent home. */
  readonly home: string;
  /** The slot table. */
  readonly slots: SlotTable;
  /** The components to install, providers first. */
  readonly components: readonly InstalledComponent[];
  /** The generated files of the run. */
  readonly files: readonly PlannedGeneratedFile[];
  /** The install state of the last run, if there is one. */
  readonly previous: StateInstallState | undefined;
  /** Components that failed and stay exactly as the last run left them: their links are neither changed nor removed. */
  readonly frozen: readonly string[];
}

const failure = (check: string, item: string, line: string): readonly Notice[] => [
  { severity: 'error', check, item, line },
];

function relativeTo(home: string, target: string, flavor: 'posix' | 'win32'): string {
  return path[flavor].relative(home, target).split(path[flavor].sep).join('/');
}

// The entries of the agent home this run puts there, in the words of the compatibility table: every link below the home, and a file
// inside a linked folder when that file exists in the folder the link points at (so no compatibility link dangles).
function homeEntriesOf(context: PlanContext, links: readonly DesiredLink[]): ReadonlySet<string> {
  const { deps, home } = context;
  const flavor = deps.environment.flavor;
  const placed = links.map((link) => ({ rel: relativeTo(home, link.path, flavor), target: link.target }));
  const entries = new Set(placed.map((link) => link.rel));
  for (const name of deps.wiring.compatHomeEntries(deps.environment.userHome, home, flavor)) {
    const holder = placed.find((link) => name.startsWith(`${link.rel}/`));
    if (holder !== undefined && deps.disk.entryKind(holder.target, name.slice(holder.rel.length + 1)) !== 'missing') {
      entries.add(name);
    }
  }
  return entries;
}

function observeAll(deps: CommandsDeps, paths: readonly string[]): ReadonlyMap<string, WiringObservation> {
  return new Map(paths.map((each) => [each, deps.disk.observe(each)]));
}

function compatSteps(plan: ReturnType<CommandsDeps['wiring']['planCompat']>): readonly LinkStep[] {
  return plan.operations.map((operation) => ({
    path: operation.path,
    target: operation.target,
    class: 'compat',
    component: operation.component,
    how: operation.backup ? 'replace' : operation.old.state === 'link' ? 'switch' : 'create',
    old: operation.old,
  }));
}

/** What the retired list says about the links of the last run. */
interface RetiredPart {
  /** The decision for each retired path, in list order. */
  readonly decisions: readonly WiringRetiredDecision[];
  /** The retired paths, so the compatibility plan does not place them again. */
  readonly paths: ReadonlySet<string>;
}

function isFailure<Part extends object>(value: Part | readonly Notice[]): value is readonly Notice[] {
  return Array.isArray(value);
}

function retiredPart(context: PlanContext): RetiredPart | readonly Notice[] {
  const { deps } = context;
  const text = deps.disk.readOptionalText(deps.environment.repoRoot, 'compat.yaml');
  const list = deps.wiring.readRetiredList(text, deps.environment.userHome, deps.environment.flavor);
  if (!list.ok) {
    const file = path[deps.environment.flavor].join(deps.environment.repoRoot, 'compat.yaml');
    return failure('list-invalid', 'compat.yaml', renderMessage('MG-23', { list: file, sentence: list.error }));
  }
  const recorded = (context.previous?.entries ?? [])
    .filter((entry) => entry.class === 'compat' && entry.target !== undefined)
    .map((entry) => ({ path: entry.path, target: entry.target ?? '' }));
  return {
    decisions: deps.wiring.planRetired({ entries: list.value, recorded }),
    paths: new Set(list.value.map((entry) => entry.path)),
  };
}

// The links of the mounts and the one link of the generated variables file, with what is at each path now.
interface MountPart {
  readonly wanted: readonly DesiredLink[];
  readonly steps: readonly LinkStep[];
  readonly folders: readonly string[];
}

function mountPart(
  context: PlanContext,
  observed: (paths: readonly string[]) => ReadonlyMap<string, WiringObservation>,
): MountPart | readonly Notice[] {
  const { deps, home } = context;
  const flavor = deps.environment.flavor;
  const flavored = path[flavor];
  // A git tree that is not in the store yet is listed in the clone it will be copied from; the links still point into the store.
  const realFolders = sharedFolders(context.components, context.slots, flavor);
  const readable = sharedFolders(checkableComponents(deps, context.components), context.slots, flavor);
  const entries = new Map(
    realFolders.map((folder, index) => [folder, deps.disk.listEntries(readable[index] ?? folder) ?? []]),
  );
  const mounts = mountLinks(context.components, context.slots, { home, flavor, entries });
  if (!mounts.ok) return failure('mount-clash', 'mounts', renderMessage('MG-38', { what: mounts.error }));
  const variablesLink: DesiredLink = {
    path: flavored.join(home, VARIABLES_LINK),
    target: flavored.join(home, 'generated', VARIABLES_LINK),
    class: 'generated',
    component: 'core',
  };
  const wanted = [...mounts.value.links, variablesLink];
  const recorded = new Map((context.previous?.entries ?? []).map((entry) => [entry.path, entry]));
  const seen = observed(wanted.map((link) => link.path));
  const steps = wanted.map((link) => stepFor(link, seen.get(link.path) ?? { kind: 'absent' }, recorded.get(link.path)));
  const blocked = steps.filter((step): step is Blocked => !('how' in step));
  if (blocked.length > 0) {
    return blocked.map((one) => ({
      severity: 'error',
      check: 'blocked',
      item: one.path,
      line: renderMessage('MG-38', { what: `something that is not a file, folder or link is where ${one.path} goes` }),
    }));
  }
  return { wanted, steps: steps as LinkStep[], folders: mounts.value.folders };
}

function writesPart(context: PlanContext): BuiltPlan['plan']['writes'] {
  const { deps, home } = context;
  const flavored = path[deps.environment.flavor];
  const recorded = new Map((context.previous?.entries ?? []).map((entry) => [entry.path, entry.hash]));
  const onDisk = new Map(
    context.files.map((file) => [file.relativePath, deps.disk.readOptionalText(home, file.relativePath)]),
  );
  const hashes = new Map(
    context.files.map((file) => [
      file.relativePath,
      recorded.get(flavored.join(home, ...file.relativePath.split('/'))),
    ]),
  );
  return writeSteps(context.files, home, deps.environment.flavor, { onDisk, recorded: hashes });
}

/**
 * Looks at the disk and builds the plan of the run.
 *
 * @param context - the services, the home, the components and the files to write
 * @returns the plan with the retired lines and the carried entries, or the errors that stop the run
 */
export function buildInstallPlan(context: PlanContext): BuiltPlan | readonly Notice[] {
  const { deps, home } = context;
  const previousEntries = context.previous?.entries ?? [];
  const observed = (paths: readonly string[]): ReadonlyMap<string, WiringObservation> => observeAll(deps, paths);
  // 1. The links of the mounts and of the variables file, then what the retired list says about the last run's compatibility links.
  const mounts = mountPart(context, observed);
  if (isFailure(mounts)) return mounts;
  const retired = retiredPart(context);
  if (isFailure(retired)) return retired;
  // 2. The compatibility links, which are placed only where their target is installed.
  const compat = deps.wiring.planCompat({
    userHome: deps.environment.userHome,
    home,
    flavor: deps.environment.flavor,
    homeEntries: homeEntriesOf(context, mounts.wanted),
    retired: retired.paths,
  });
  const links = [...mounts.steps, ...compatSteps(compat)];
  // 3. The links of the last run that this run no longer wants, and the entries that stay recorded as they are.
  const kept = retired.decisions.filter((one) => one.action === 'kept').map((one) => one.path);
  const stays = previousEntries.filter((entry) => context.frozen.includes(entry.component) && !entry.privileged);
  const keep = new Set([
    ...links.map((step) => step.path),
    ...compat.unchanged,
    ...kept,
    ...stays.map((entry) => entry.path),
  ]);
  const unlinks = obsoleteLinks(previousEntries, keep, observed(previousEntries.map((entry) => entry.path)));
  const carried = [
    ...previousEntries.filter((entry) => compat.unchanged.includes(entry.path) || kept.includes(entry.path)),
    ...stays,
  ];
  const folders = [...mounts.folders, ...compat.ensureFolders, path[deps.environment.flavor].join(home, 'generated')];
  return {
    plan: { folders, writes: writesPart(context), links, unlinks, compat },
    retiredLines: deps.wiring.renderRetired(retired.decisions),
    carried,
  };
}
