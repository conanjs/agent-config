// Step "apply" of the pipeline (DR-202): stage the trees, check them, back up what is replaced, write the journal, write the generated
// files, switch the links, and only then write `components.lock` and `install-state.json`, which is the commit point. A failure at any
// step before the commit puts the previous state back and writes neither file, so a failed run leaves the old links and the old lock.
// A kill leaves the journal, and the next run restores from it (EDGE-4); no exit handler cleans up, by design.
import path from 'node:path';
import { renderMessage } from '#shared/domain/messages/renderMessage.ts';
import type { SlotTable } from '#manifests/application/ManifestTypes.ts';
import type {
  StateComponentsLock,
  StateInstallState,
  StateJournal,
  StateJournalOperation,
} from '#state/application/StateTypes.ts';
import type { Notice } from '#commands/application/install/CommandOutput.ts';
import type { CommandsDeps, HomeServices } from '#commands/application/install/InstallTypes.ts';
import type {
  InstalledComponent,
  InstallPlan,
  LinkStep,
  WriteStep,
} from '#commands/application/install/PlanInstall.ts';
import { validateStaged } from '#commands/application/install/ValidateStaged.ts';

/** What the apply step is given. */
export interface ApplyInput {
  /** The services the commands were given. */
  readonly deps: CommandsDeps;
  /** The services of the agent home. */
  readonly services: HomeServices;
  /** The agent home. */
  readonly home: string;
  /** The slot table, for the checks of the staged trees. */
  readonly slots: SlotTable;
  /** The components to install. */
  readonly components: readonly InstalledComponent[];
  /** The plan. */
  readonly plan: InstallPlan;
  /** Builds the lock and the state of the run once the links are placed; it gets the kind each link became. */
  readonly records: (placedKinds: ReadonlyMap<string, 'symlink' | 'junction' | 'copy'>) => {
    readonly lock: StateComponentsLock;
    readonly state: StateInstallState;
  };
  /** Components that left both lists, whose managed clone is removed after the commit (EDGE-6). */
  readonly removedComponents: readonly string[];
}

/** How the apply step ended. */
export type ApplyOutcome =
  | { readonly kind: 'applied'; readonly backup: string | null; readonly degraded: readonly string[] }
  | { readonly kind: 'failed'; readonly errors: readonly Notice[]; readonly backup: string | null };

const failed = (what: string, cause: string | undefined, backup: string | null = null): ApplyOutcome => ({
  kind: 'failed',
  backup,
  errors: [
    {
      severity: 'error',
      check: 'install',
      item: what,
      line: renderMessage('MG-38', { what }),
      ...(cause === undefined ? {} : { more: [renderMessage('MG-38.cause', { cause })] }),
    },
  ],
});

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : 'unknown error';
}

// A link in a folder the run owns, made and removed at once, tells before anything is touched whether this account may make links
// (EDGE-3, C-7): a refusal here leaves nothing behind. The target is a folder, so a Windows account that can only make junctions passes.
function linksAllowed(input: ApplyInput): string | undefined {
  const { services, home } = input;
  const flavored = path[input.deps.environment.flavor];
  const target = flavored.join(home, 'generated');
  const probe = flavored.join(home, '.link-probe');
  try {
    const made = services.state.ensureFolder(target);
    if (!made.ok) return made.error.reason;
    const placed = services.state.placeLink({ path: probe, target, kind: 'symlink' });
    if (!placed.ok) return placed.error.reason;
    services.state.removeLink({ path: probe, target });
    return undefined;
  } catch (error) {
    return messageOf(error);
  }
}

function backupPaths(plan: InstallPlan): readonly string[] {
  const replaced = plan.links.filter((step) => step.how === 'replace').map((step) => step.path);
  const rewritten = plan.writes.filter((step) => !step.unchanged && step.exists).map((step) => step.path);
  return [...replaced, ...rewritten];
}

function linkOperation(
  step: LinkStep,
  backupOf: (original: string) => string | undefined,
): StateJournalOperation | undefined {
  const base = { op: 'link' as const, path: step.path, kind: 'symlink' as const, target: step.target };
  if (step.how === 'create') return { ...base, old: { state: 'absent' } };
  if (step.how === 'switch' && step.old.state === 'link') {
    return { ...base, old: { state: 'link', target: step.old.target, kind: 'symlink' } };
  }
  const backup = backupOf(step.path);
  return backup === undefined ? undefined : { ...base, old: { state: 'backed-up', backup } };
}

function writeOperation(
  step: WriteStep,
  backupOf: (original: string) => string | undefined,
): StateJournalOperation | undefined {
  if (!step.exists) return { op: 'write', path: step.path, hash: step.file.hash, old: { state: 'absent' } };
  const backup = backupOf(step.path);
  return backup === undefined
    ? undefined
    : { op: 'write', path: step.path, hash: step.file.hash, old: { state: 'file', backup } };
}

/**
 * Builds the operations of the journal in the order the run performs them: writes, then links, then removals.
 *
 * @param plan - the plan of the run
 * @param backupOf - finds the copy that was made of a path before it is replaced
 * @returns the operations, or `undefined` when a replaced path has no backup (the run stops rather than replace what it cannot restore)
 */
function journalOperations(
  plan: InstallPlan,
  backupOf: (original: string) => string | undefined,
): readonly StateJournalOperation[] | undefined {
  const writes = plan.writes.filter((step) => !step.unchanged).map((step) => writeOperation(step, backupOf));
  const links = plan.links.filter((step) => step.how !== 'unchanged').map((step) => linkOperation(step, backupOf));
  const unlinks = plan.unlinks.map((step): StateJournalOperation => ({
    op: 'unlink',
    path: step.path,
    old: { state: 'link', target: step.target, kind: step.kind },
  }));
  const all = [...writes, ...links];
  const found = all.filter((operation): operation is StateJournalOperation => operation !== undefined);
  return found.length === all.length ? [...found, ...unlinks] : undefined;
}

// Puts the previous state back after a failure that came after the journal was written; nothing is thrown out of here.
function undo(input: ApplyInput): void {
  try {
    input.services.state.restoreFromJournal();
  } catch {
    // The journal stays on disk, and the next `install` or `doctor` restores from it (EDGE-4), so a failed restore loses nothing.
  }
}

function discardStaged(input: ApplyInput, staged: readonly InstalledComponent[]): void {
  for (const one of staged) {
    if (one.storeId !== undefined)
      input.services.state.removeManagedFolder({ area: 'store', name: one.name, id: one.storeId });
  }
}

interface Staging {
  readonly made: readonly InstalledComponent[];
  readonly failure: ApplyOutcome | undefined;
}

function stageTrees(input: ApplyInput): Staging {
  const made: InstalledComponent[] = [];
  for (const one of input.components) {
    if (one.origin !== 'git' || one.storeId === undefined) continue;
    const staged = input.services.state.stageTree({ from: one.sourceRoot, name: one.name, id: one.storeId });
    if (!staged.ok)
      return { made, failure: failed(`cannot stage the tree of component ${one.name}`, staged.error.reason) };
    if (staged.value.how === 'staged') made.push(one);
  }
  return { made, failure: undefined };
}

// The part of the run that changes the home: journal, writes, switch, commit. Every refusal and every thrown error undoes the journal.
function switchAndCommit(input: ApplyInput, journal: StateJournal, backup: string | null): ApplyOutcome {
  const { state } = input.services;
  const written = state.writeJournal(journal);
  if (!written.ok) return failed('the journal cannot be written', undefined, backup);
  const files = input.services.rendering.writeGeneratedFiles(
    input.plan.writes.filter((step) => !step.unchanged).map((step) => step.file),
  );
  if (!files.ok) return failed('a generated file cannot be written', files.error.refusal.kind, backup);
  // A `path` source and the checkout of agent-config are linked live from where they lie, so their folders are the allowed targets outside the home.
  const liveRoots = input.components.filter((one) => one.origin !== 'git').map((one) => one.contentRoot);
  const switched = state.switchLinks(journal, liveRoots);
  if (!switched.ok) return failed('cannot create links', switched.error.refusal.reason, backup);
  const kinds = new Map(switched.value.map((one) => [one.path, one.placed.kind] as const));
  const { lock, state: next } = input.records(kinds);
  const committed = state.commit(lock, next);
  if (!committed.ok) return failed('the install state cannot be written', undefined, backup);
  return {
    kind: 'applied',
    backup,
    degraded: switched.value.filter((one) => one.placed.degraded).map((one) => one.path),
  };
}

// After the commit, a component that left both lists loses its managed clone (EDGE-6), and the store keeps the current and previous tree.
function afterCommit(input: ApplyInput): void {
  const current = Object.fromEntries(
    input.components.flatMap((one) => (one.storeId === undefined ? [] : [[one.name, one.storeId] as const])),
  );
  for (const name of input.removedComponents) input.services.state.removeManagedFolder({ area: 'components', name });
  input.services.state.pruneStore(current);
}

// Everything up to the journal: folders, the staged trees and their checks, and the backup. A refusal ends the run with nothing linked.
interface Prepared {
  readonly staged: readonly InstalledComponent[];
  readonly journal: StateJournal;
  readonly backup: string | null;
}

function foldersFailure(input: ApplyInput): ApplyOutcome | undefined {
  for (const folder of input.plan.folders) {
    const made = input.services.state.ensureFolder(folder);
    if (!made.ok) return failed('a folder cannot be made', made.error.reason);
  }
  return undefined;
}

function prepare(input: ApplyInput): Prepared | ApplyOutcome {
  const { state } = input.services;
  const staging = stageTrees(input);
  if (staging.failure !== undefined) return staging.failure;
  const errors = validateStaged(input.deps, input.slots, input.components);
  if (errors.length > 0) {
    discardStaged(input, staging.made);
    return { kind: 'failed', errors, backup: null };
  }
  const backed = state.backup(backupPaths(input.plan));
  if (!backed.ok) {
    discardStaged(input, staging.made);
    return failed('a backup cannot be made', backed.error.reason);
  }
  const made = backed.value.kind === 'made' ? backed.value : undefined;
  const flavored = path[input.deps.environment.flavor];
  const backupOf = (original: string): string | undefined => {
    const item = made?.items.find((each) => each.original === original);
    return made === undefined || item === undefined ? undefined : flavored.join(made.folder, item.backup);
  };
  const operations = journalOperations(input.plan, backupOf);
  if (operations === undefined) {
    discardStaged(input, staging.made);
    return failed('a backup is missing', undefined, made?.folder ?? null);
  }
  const started = input.deps.clock.now().toISOString();
  return {
    staged: staging.made,
    backup: made?.folder ?? null,
    journal: { home: input.home, command: 'install', started, operations },
  };
}

const isOutcome = (value: Prepared | ApplyOutcome): value is ApplyOutcome => 'kind' in value;

/**
 * Applies a plan: stages the trees, checks them, backs up what is replaced, journals the plan, writes the generated files, switches the
 * links and commits.
 *
 * Nothing before the commit changes what the agents read except through the journaled switch; a failure there restores the previous
 * links, and `components.lock` and `install-state.json` are written only after every link is placed.
 *
 * @param input - the services, the plan and how to build the records
 * @returns the outcome with the backup folder when one was made, or the errors that failed the run
 */
export function applyInstall(input: ApplyInput): ApplyOutcome {
  // 1. Can this account make links at all? Asked before anything is created (EDGE-3).
  const refused = linksAllowed(input);
  if (refused !== undefined) return failed('cannot create links', refused);
  let staged: readonly InstalledComponent[] = [];
  try {
    // 2. The folders, the staged trees and their checks, the backup and the journal.
    const folders = foldersFailure(input);
    if (folders !== undefined) return folders;
    const prepared = prepare(input);
    if (isOutcome(prepared)) return prepared;
    staged = prepared.staged;
    // 3. Write, switch and commit; any refusal or error puts the previous state back.
    const outcome = switchAndCommit(input, prepared.journal, prepared.backup);
    if (outcome.kind === 'failed') {
      undo(input);
      discardStaged(input, staged);
      return outcome;
    }
    afterCommit(input);
    return outcome;
  } catch (error) {
    undo(input);
    discardStaged(input, staged);
    return failed('cannot create links', messageOf(error));
  }
}
