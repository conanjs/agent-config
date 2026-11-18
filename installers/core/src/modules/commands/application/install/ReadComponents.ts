// Steps "read" of the pipeline: both lists and the slots, then each listed component brought to a folder and its manifest read. A
// `path` source is read where it lies; a `git` source is acquired into its managed clone first (a plain run stays on the locked commit,
// only `install --update` advances, M-02). Every fault of one component either skips that component (FR-021, AC-3.5, AC-5.8, M-17), or,
// when the component is already locked, fails the run so the previous version stays (AC-7.2). Reading never links or switches anything.
import { mergeLists, splitArchiveEntries } from '#manifests/application/ListOperations.ts';
import type { ManifestsApi } from '#manifests/application/ManifestsApi.ts';
import type { ComponentManifest, MergedEntry, SlotTable } from '#manifests/application/ManifestTypes.ts';
import {
  renderComponentWarning,
  renderFileIssue,
  renderOverride,
  renderPathSourceMissing,
  renderPathSourceRefused,
  renderSkipWarning,
} from '#manifests/application/messages/renderManifestMessages.ts';
import { renderMessage } from '#shared/domain/messages/renderMessage.ts';
import type { StateComponentsLock } from '#state/application/StateTypes.ts';
import type { GitAcquired, LockedGit } from '#sources/application/SourceTypes.ts';
import {
  renderFetchFailure,
  renderGitComponent,
  renderGitRefused,
  renderPathComponent,
  renderSubmodulesWarning,
  renderTagMoved,
  renderUpdated,
} from '#sources/application/messages/renderSourceMessages.ts';
import type { PublicAgentHomeChoice } from '#variables/application/VariablesTypes.ts';
import type { Notice } from '#commands/application/install/CommandOutput.ts';
import type { CommandsDeps, UpdateRequest } from '#commands/application/install/InstallTypes.ts';
import path from 'node:path';

/** A component whose folder was found and whose manifest is valid. */
export interface LoadedComponent {
  /** The name from the list. */
  readonly name: string;
  /** The validated manifest. */
  readonly manifest: ComponentManifest;
  /** The folder the manifest was read from: the folder of a `path` source, or the managed clone of a `git` source. */
  readonly sourceRoot: string;
  /** The list entry, with the source that is used and the public one it replaced. */
  readonly entry: MergedEntry;
  /** The acquired git source, absent for a `path` source. */
  readonly git: GitAcquired | undefined;
}

/** A listed component that could not be acquired or whose manifest is no longer valid. */
export interface ComponentFailure {
  /** The component name. */
  readonly name: string;
  /** The list entry. */
  readonly entry: MergedEntry;
  /** What went wrong, as the lines to print. */
  readonly notices: readonly Notice[];
}

/** What reading the lists and every component gave. */
export interface ReadOutcome {
  /** The slots of slots/v1. */
  readonly slots: SlotTable;
  /** Agent-config's own manifest and the folder it was read from, or undefined when it could not be read. */
  readonly core: { readonly manifest: ComponentManifest; readonly root: string } | undefined;
  /** The components with a valid manifest, in list order. */
  readonly loaded: readonly LoadedComponent[];
  /** The progress lines in print order: overrides, component lines, updates. */
  readonly progress: readonly string[];
  /** The warnings. */
  readonly warnings: readonly Notice[];
  /** The faults of the run itself (the slots, a list, agent-config's own manifest); when any, nothing else can be read and the run fails with exit 1. */
  readonly errors: readonly Notice[];
  /** The components that failed to be acquired or read, each with its errors: the previous version stays, or the component is left out (DR-418). */
  readonly failures: readonly ComponentFailure[];
  /** Every entry of the merged lists that is not an archive, in list order. */
  readonly entries: readonly MergedEntry[];
  /** The override lines (MG-20), which come before the component lines. */
  readonly overrides: readonly string[];
}

/** What the read step needs from the run. */
export interface ReadContext {
  /** The services the commands were given. */
  readonly deps: CommandsDeps;
  /** The agent home of the run. */
  readonly home: PublicAgentHomeChoice;
  /** `install` may fetch; `plan` never writes, so it reads only what is already there. */
  readonly command: 'install' | 'plan';
  /** Which git sources to advance. */
  readonly update: UpdateRequest;
  /** The lock of the last run, if there is one. */
  readonly lock: StateComponentsLock | undefined;
}

/** The name of agent-config's own component, the one that fills the reserved `core` slot (its `component.yaml` is at the root of the checkout). */
export const CORE_COMPONENT_NAME = 'agent-config';

const notice = (
  severity: Notice['severity'],
  check: string,
  item: string,
  line: string,
  more: readonly string[] = [],
): Notice => ({ severity, check, item, line, ...(more.length > 0 ? { more } : {}) });

/**
 * Tells whether `install --update` names a git source.
 *
 * @param update - the request
 * @param name - the component name
 * @returns true for `--update` alone and for `--update` naming this component
 */
export function isUpdateTarget(update: UpdateRequest, name: string): boolean {
  return update.kind === 'all' || (update.kind === 'named' && update.names.includes(name));
}

/**
 * Finds what the lock holds for a git source, but only when the list still names the same address and ref, so a changed source is
 * resolved afresh instead of staying on a commit of another repository (M-02).
 *
 * @param lock - the lock of the last run
 * @param entry - the list entry with a git source
 * @returns the locked commit and tag, or undefined
 */
export function lockedGitOf(lock: StateComponentsLock | undefined, entry: MergedEntry): LockedGit | undefined {
  const locked = lock?.components[entry.name];
  if (locked === undefined || entry.source.type !== 'git') return undefined;
  const { source, resolved } = locked;
  const sameSource =
    source['type'] === 'git' && source['url'] === entry.source.url && source['ref'] === entry.source.ref;
  return sameSource && 'commit' in resolved
    ? { commit: resolved.commit, ...(resolved.tag === undefined ? {} : { tag: resolved.tag }) }
    : undefined;
}

function listFailures(file: string, list: ReturnType<ManifestsApi['readComponentList']>): readonly Notice[] {
  if (list.ok) return [];
  return list.error.issues.map((issue) =>
    notice('error', 'list-invalid', file, renderFileIssue(list.error.file, issue)),
  );
}

interface Lists {
  readonly entries: readonly MergedEntry[];
  readonly archive: readonly string[];
}

function readLists(context: ReadContext): { readonly lists?: Lists; readonly errors: readonly Notice[] } {
  const { deps, home } = context;
  const publicList = deps.manifests.readComponentList({ kind: 'public', root: deps.environment.repoRoot });
  const localList = deps.manifests.readComponentList({ kind: 'local', root: home.path });
  const errors = [...listFailures('components.yaml', publicList), ...listFailures('components.local.yaml', localList)];
  if (!publicList.ok || !localList.ok) return { errors };
  const merged = mergeLists(publicList.value, localList.value);
  const split = splitArchiveEntries(merged);
  return { lists: { entries: split.usable, archive: split.archiveNames }, errors };
}

// The check line names the component; the line under it says why, so V can fix the file without guessing (the reader's own sentence).
function schemaFailure(name: string, reason?: Parameters<typeof renderSkipWarning>[0]['reason']): Notice {
  const line = renderMessage('MG-37', { check: renderMessage('MG-37.schema', { component: name }) });
  const cause = reason?.kind === 'invalid' ? [renderMessage('MG-38.cause', { cause: reason.sentence })] : [];
  return notice('error', 'schema', name, line, cause);
}

// What one component's folder gave, in the terms of this step.
type OneRead =
  | { readonly kind: 'loaded'; readonly loaded: LoadedComponent; readonly warnings: readonly Notice[] }
  | { readonly kind: 'skipped'; readonly notices: readonly Notice[] }
  | { readonly kind: 'failed'; readonly notices: readonly Notice[] };

function readFolder(
  context: ReadContext,
  slots: SlotTable,
  entry: MergedEntry,
  root: string,
  git: GitAcquired | undefined,
): OneRead {
  const { deps, home } = context;
  const guard = { userHome: deps.environment.userHome, agentHome: home.path };
  const source = entry.source.type === 'path' ? ({ kind: 'path', guard } as const) : ({ kind: 'clone' } as const);
  const read = deps.manifests.readComponent({ name: entry.name, root, slots, source });
  if (read.kind === 'folder-missing') {
    return {
      kind: 'failed',
      notices: [notice('error', 'path-source-missing', entry.name, renderPathSourceMissing(entry.name, read.folder))],
    };
  }
  if (read.kind === 'source-refused') {
    return {
      kind: 'failed',
      notices: [
        notice(
          'error',
          'path-source-refused',
          entry.name,
          renderPathSourceRefused(entry.name, read.folder, read.reason),
        ),
      ],
    };
  }
  if (read.kind === 'skipped') return skippedRead(context, entry.name, read.skip);
  const warnings = read.warnings.map((finding) =>
    notice('warning', 'manifest-warning', entry.name, renderComponentWarning(entry.name, finding)),
  );
  return {
    kind: 'loaded',
    loaded: { name: entry.name, manifest: read.manifest, sourceRoot: root, entry, git },
    warnings,
  };
}

// A component already in the lock whose manifest is now invalid or gone fails the run, so its previous version stays linked
// (AC-7.2); a component the run has never installed is left out with a warning and the others install (AC-3.5, M-17).
function skippedRead(context: ReadContext, name: string, skip: Parameters<typeof renderSkipWarning>[0]): OneRead {
  const wasInstalled = context.lock?.components[name] !== undefined;
  const reason = skip.reason.kind;
  if (wasInstalled && (reason === 'invalid' || reason === 'no-manifest')) {
    return { kind: 'failed', notices: [schemaFailure(name, skip.reason)] };
  }
  return { kind: 'skipped', notices: [notice('warning', 'component-skipped', name, renderSkipWarning(skip))] };
}

function gitFailure(
  result: Exclude<Awaited<ReturnType<CommandsDeps['sources']['acquireGit']>>, GitAcquired>,
): readonly Notice[] {
  if (result.kind === 'tag-moved') return [notice('error', 'tag-moved', result.name, renderTagMoved(result))];
  if (result.kind === 'refused') return [notice('error', 'git-refused', result.name, renderGitRefused(result))];
  const [first, ...cause] = renderFetchFailure(result);
  return [notice('error', 'fetch-failed', result.name, first ?? '', cause)];
}

async function readGit(
  context: ReadContext,
  slots: SlotTable,
  entry: MergedEntry,
): Promise<OneRead & { readonly line?: readonly string[] }> {
  const { deps, home } = context;
  if (entry.source.type !== 'git') throw new Error('readGit is called for a git source only');
  const dest = path[deps.environment.flavor].join(home.path, 'components', entry.name);
  const locked = lockedGitOf(context.lock, entry);
  if (context.command === 'plan') return readClone(context, slots, entry, dest, locked);
  const acquired = await deps.sources.acquireGit({
    name: entry.name,
    url: entry.source.url,
    ref: entry.source.ref,
    dest,
    locked,
    update: isUpdateTarget(context.update, entry.name),
  });
  if (acquired.kind !== 'acquired') return { kind: 'failed', notices: gitFailure(acquired) };
  return { ...readFolder(context, slots, entry, dest, acquired) };
}

// `plan` never clones or fetches: a clone that is already there and a lock entry say what the next install would read.
function readClone(
  context: ReadContext,
  slots: SlotTable,
  entry: MergedEntry,
  dest: string,
  locked: LockedGit | undefined,
): OneRead {
  const there = context.deps.disk.observe(dest).kind === 'folder';
  if (!there || locked === undefined) {
    return {
      kind: 'skipped',
      notices: [notice('warning', 'not-fetched', entry.name, renderMessage('MG-49', { name: entry.name }))],
    };
  }
  const acquired: GitAcquired = {
    kind: 'acquired',
    name: entry.name,
    url: entry.source.type === 'git' ? entry.source.url : '',
    ref: entry.source.type === 'git' ? entry.source.ref : '',
    commit: locked.commit,
    tag: locked.tag,
    advancedFrom: undefined,
    submodules: false,
  };
  return readFolder(context, slots, entry, dest, acquired);
}

function readPath(context: ReadContext, slots: SlotTable, entry: MergedEntry): OneRead {
  if (entry.source.type !== 'path') throw new Error('readPath is called for a path source only');
  const found = context.deps.sources.acquirePath({ name: entry.name, path: entry.source.path });
  if (found.kind === 'missing') {
    return {
      kind: 'failed',
      notices: [notice('error', 'path-source-missing', entry.name, renderPathSourceMissing(entry.name, found.folder))],
    };
  }
  return readFolder(context, slots, entry, entry.source.path, undefined);
}

function readCore(
  context: ReadContext,
  slots: SlotTable,
): { readonly core: ReadOutcome['core']; readonly errors: readonly Notice[] } {
  const { deps } = context;
  const root = deps.environment.repoRoot;
  const read = deps.manifests.readComponent({ name: CORE_COMPONENT_NAME, root, slots, source: { kind: 'core' } });
  if (read.kind === 'loaded') return { core: { manifest: read.manifest, root }, errors: [] };
  return {
    core: undefined,
    errors: [schemaFailure(CORE_COMPONENT_NAME, read.kind === 'skipped' ? read.skip.reason : undefined)],
  };
}

/**
 * Writes the progress lines of a component that is installed: its source and commit, the range of an update, and a submodule warning.
 *
 * @param loaded - a component that was read
 * @returns the lines of MG-14, MG-15 and MG-22 that apply
 */
export function progressOf(loaded: LoadedComponent): readonly string[] {
  const { git, entry } = loaded;
  if (git !== undefined) {
    const updated = renderUpdated(git);
    const submodules = renderSubmodulesWarning(git);
    return [
      renderGitComponent(git),
      ...(updated === undefined ? [] : [updated]),
      ...(submodules === undefined ? [] : [submodules]),
    ];
  }
  return entry.source.type === 'path'
    ? [renderPathComponent({ kind: 'acquired', name: entry.name, path: entry.source.path })]
    : [];
}

interface Collected {
  readonly slots: SlotTable;
  readonly core: ReadOutcome['core'];
  readonly coreErrors: readonly Notice[];
  readonly lists: Lists;
  readonly results: readonly { readonly entry: MergedEntry; readonly read: OneRead }[];
}

// What each component gave, in list order: the loaded ones, the warnings, the failures and the lines of progress.
function collect(found: Collected): ReadOutcome {
  const { results, lists } = found;
  const loaded = results.flatMap(({ read }) => (read.kind === 'loaded' ? [read.loaded] : []));
  const overrides = lists.entries.flatMap((entry) => renderOverride(entry) ?? []);
  const archive = lists.archive.map((name) =>
    notice('warning', 'component-skipped', name, renderSkipWarning({ name, reason: { kind: 'archive' } })),
  );
  const warnings = [
    ...archive,
    ...results.flatMap(({ read }) =>
      read.kind === 'loaded' ? read.warnings : read.kind === 'skipped' ? read.notices : [],
    ),
  ];
  const failures = results.flatMap(({ entry, read }) =>
    read.kind === 'failed' ? [{ name: entry.name, entry, notices: read.notices }] : [],
  );
  return {
    slots: found.slots,
    core: found.core,
    loaded,
    progress: [...overrides, ...loaded.flatMap(progressOf)],
    warnings,
    errors: found.coreErrors,
    failures,
    entries: lists.entries,
    overrides,
  };
}

/**
 * Reads the slots, both lists, agent-config's own manifest and every listed component, in that order.
 *
 * @param context - the services, the home, the command, the update request and the lock
 * @returns the loaded components, the lines and warnings of the read, and the errors that fail the run
 */
export async function readComponents(context: ReadContext): Promise<ReadOutcome> {
  const { deps } = context;
  // 1. The slots, then both lists; a fault in either refuses the whole file (MG-23).
  const slotsRead = deps.manifests.readSlots({ root: deps.environment.repoRoot });
  const empty = {
    slots: { slots: [] },
    core: undefined,
    loaded: [],
    progress: [],
    warnings: [],
    failures: [],
    entries: [],
    overrides: [],
  } as const;
  if (!slotsRead.ok) {
    const lines = slotsRead.error.issues.map((issue) =>
      notice('error', 'slots-invalid', 'slots.yaml', renderFileIssue(slotsRead.error.file, issue)),
    );
    return { ...empty, errors: lines };
  }
  const slots = slotsRead.value;
  const listed = readLists(context);
  if (listed.lists === undefined) return { ...empty, slots, errors: listed.errors };
  // 2. Agent-config's own manifest, then each listed component.
  const core = readCore(context, slots);
  const results: { entry: MergedEntry; read: OneRead }[] = [];
  for (const entry of listed.lists.entries) {
    const read = entry.source.type === 'git' ? await readGit(context, slots, entry) : readPath(context, slots, entry);
    results.push({ entry, read });
  }
  return collect({ slots, core: core.core, coreErrors: core.errors, lists: listed.lists, results });
}
