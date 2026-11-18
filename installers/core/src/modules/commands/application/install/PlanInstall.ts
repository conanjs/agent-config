// Step "plan" of the pipeline (DR-306): one pure planner turns what the earlier steps found into the operations of the run. `plan`
// prints them, `install` applies the same list, the journal is this list plus what each path held before, and the state records the
// resulting entries. Nothing here touches a disk: the caller observes the paths first and hands the observations in.
import path from 'node:path';
import type { ComponentManifest, Slot, SlotTable } from '#manifests/application/ManifestTypes.ts';
import type { PlannedGeneratedFile } from '#rendering/application/generated/planVariablesFiles.ts';
import type { Placed } from '#resolution/application/ResolutionTypes.ts';
import { canonicalJson } from '#shared/domain/hash/canonicalJson.ts';
import { sha256Hex } from '#shared/domain/hash/sha256Hex.ts';
import type { PathFlavor } from '#shared/domain/path/PathContainment.ts';
import { refuse, succeed, type Result } from '#shared/domain/result/Result.ts';
import type { GitAcquired } from '#sources/application/SourceTypes.ts';
import type { StateInstallStateEntry } from '#state/application/StateTypes.ts';
import type { WiringCompatPlan, WiringObservation, WiringOldContent } from '#wiring/application/WiringTypes.ts';
import type { LoadedComponent } from '#commands/application/install/ReadComponents.ts';

/** The renderer and adapter versions that go into the id of a store tree; a linked tree has neither yet (DR-202, data-model StoreTree). */
const STORE_ID_PARTS = { renderer: 'none', adapter: 'none' } as const;

/** The file name of the link that makes the generated variables file readable at the old place (DR-414). */
export const VARIABLES_LINK = 'global-variables.md';

/** One component of the run with the folders its links point at. */
export interface InstalledComponent {
  /** The component name. */
  readonly name: string;
  /** The slot it fills. */
  readonly slot: string;
  /** Its validated manifest. */
  readonly manifest: ComponentManifest;
  /** Where it comes from. */
  readonly origin: 'core' | 'path' | 'git';
  /** The folder its manifest was read from: agent-config's checkout, the folder of a `path` source, or the managed clone. */
  readonly sourceRoot: string;
  /** The folder its links point into: the same as `sourceRoot` for core and `path`, the store tree for `git`. */
  readonly contentRoot: string;
  /** The acquired git source, for the commit and the store tree. */
  readonly git: GitAcquired | undefined;
  /** The 12 hex characters of its store tree, for a git source. */
  readonly storeId: string | undefined;
}

/**
 * Gives the id of the store tree of a version: the first 12 hex characters of a hash over the commit, the home and the renderer and
 * adapter versions (DR-202).
 *
 * @param commit - the 40 hex characters of the commit
 * @param home - the agent home
 * @returns 12 lower-case hex characters
 */
export function storeIdOf(commit: string, home: string): string {
  return sha256Hex(canonicalJson({ commit, home, ...STORE_ID_PARTS })).slice(0, 12);
}

/** The folders and syntax that decide where a component's links point. */
export interface FolderContext {
  /** The agent home, which holds the store. */
  readonly home: string;
  /** The checkout of agent-config, where its own component lies. */
  readonly repoRoot: string;
  /** The path syntax of the machine. */
  readonly flavor: PathFlavor;
}

/**
 * Joins the components to install with where each one's folders are.
 *
 * @param install - the placed components, providers first
 * @param loaded - the components that were read, with their folders and acquired git sources
 * @param context - the agent home, the checkout of agent-config and the path syntax
 * @returns the components in install order
 */
export function installedComponents(
  install: readonly Placed[],
  loaded: readonly LoadedComponent[],
  context: FolderContext,
): readonly InstalledComponent[] {
  const flavored = path[context.flavor];
  return install.map((placed): InstalledComponent => {
    if (placed.origin === 'core') {
      const root = context.repoRoot;
      return {
        name: placed.name,
        slot: placed.slot,
        manifest: placed.manifest,
        origin: 'core',
        sourceRoot: root,
        contentRoot: root,
        git: undefined,
        storeId: undefined,
      };
    }
    const one = loaded.find((each) => each.name === placed.name);
    const sourceRoot = one?.sourceRoot ?? '';
    if (one?.git === undefined) {
      return {
        name: placed.name,
        slot: placed.slot,
        manifest: placed.manifest,
        origin: 'path',
        sourceRoot,
        contentRoot: sourceRoot,
        git: undefined,
        storeId: undefined,
      };
    }
    const storeId = storeIdOf(one.git.commit, context.home);
    const contentRoot = flavored.join(context.home, 'store', `${placed.name}@${storeId}`);
    return {
      name: placed.name,
      slot: placed.slot,
      manifest: placed.manifest,
      origin: 'git',
      sourceRoot,
      contentRoot,
      git: one.git,
      storeId,
    };
  });
}

/** One link the run wants to exist. */
export interface DesiredLink {
  /** The absolute path of the link. */
  readonly path: string;
  /** Where it points. */
  readonly target: string;
  /** How the install state records it. */
  readonly class: 'linked' | 'generated' | 'compat';
  /** The owning component. */
  readonly component: string;
}

function mountOf(slot: Slot, locationName: string, component: string): string | undefined {
  const location = slot.locations.find((each) => each.name === locationName);
  return location?.mount.replace('{component}', component);
}

// The folder of a location inside a component, from the manifest's own map.
function locationFolder(
  item: InstalledComponent,
  locationName: string,
  flavored: path.PlatformPath,
): string | undefined {
  const folder = item.manifest.locations[locationName];
  return folder === undefined ? undefined : flavored.join(item.contentRoot, ...folder.split('/'));
}

/**
 * Lists the folders of shared locations, which are linked entry by entry and so must be listed before the links are decided (FR-027).
 *
 * @param components - the components to install
 * @param slots - the slot table
 * @param flavor - the path syntax
 * @returns the absolute folders to list
 */
export function sharedFolders(
  components: readonly InstalledComponent[],
  slots: SlotTable,
  flavor: PathFlavor,
): readonly string[] {
  const flavored = path[flavor];
  return components.flatMap((item) => {
    const slot = slots.slots.find((each) => each.name === item.slot);
    return (slot?.locations ?? []).flatMap((location) => {
      const folder = location.shared ? locationFolder(item, location.name, flavored) : undefined;
      return folder === undefined ? [] : [folder];
    });
  });
}

/** The links of the mounts and the folders they need. */
export interface MountPlan {
  /** The links in slot and location order. */
  readonly links: readonly DesiredLink[];
  /** The folders that must exist before a link is placed in them, outermost first, without the home itself. */
  readonly folders: readonly string[];
}

/** What the links of the mounts are decided from, besides the components and the slots. */
export interface MountContext {
  /** The agent home. */
  readonly home: string;
  /** The path syntax. */
  readonly flavor: PathFlavor;
  /** The names found in each shared folder, by absolute folder. */
  readonly entries: ReadonlyMap<string, readonly string[]>;
}

interface LocationLinks {
  readonly wanted: readonly { readonly path: string; readonly target: string }[];
  readonly folder: string;
}

// The links of one location of one component: the folder as a whole, or one link per name inside it for a shared location. The folder
// that must exist before they are placed is the mount itself for a shared location and the parent of the mount for any other.
function locationLinks(
  item: InstalledComponent,
  slot: Slot,
  location: Slot['locations'][number],
  context: MountContext,
): LocationLinks | undefined {
  const flavored = path[context.flavor];
  const source = locationFolder(item, location.name, flavored);
  const mount = mountOf(slot, location.name, item.name);
  if (source === undefined || mount === undefined) return undefined;
  const base = flavored.join(context.home, ...mount.split('/'));
  if (!location.shared) return { wanted: [{ path: base, target: source }], folder: flavored.dirname(base) };
  const names = context.entries.get(source) ?? [];
  const wanted = names.map((name) => ({ path: flavored.join(base, name), target: flavored.join(source, name) }));
  return { wanted, folder: base };
}

/**
 * Decides the links of every location of every component: a whole-folder link for an ordinary location, one link per entry for a
 * shared one (FR-027). Two components that would place the same path are refused.
 *
 * @param components - the components to install
 * @param slots - the slot table
 * @param context - the home, the path syntax and the entries found in each shared folder
 * @returns the plan, or the sentence that names the two components that clash
 */
export function mountLinks(
  components: readonly InstalledComponent[],
  slots: SlotTable,
  context: MountContext,
): Result<MountPlan, string> {
  const links: DesiredLink[] = [];
  const folders = new Set<string>();
  const owner = new Map<string, string>();
  for (const item of components) {
    const slot = slots.slots.find((each) => each.name === item.slot);
    for (const location of slot?.locations ?? []) {
      const found = slot === undefined ? undefined : locationLinks(item, slot, location, context);
      if (found === undefined) continue;
      folders.add(found.folder);
      for (const link of found.wanted) {
        const first = owner.get(link.path);
        if (first !== undefined) return refuse(`components ${first} and ${item.name} both place ${link.path}`);
        owner.set(link.path, item.name);
        links.push({ ...link, class: 'linked', component: item.name });
      }
    }
  }
  folders.delete(context.home);
  return succeed({ links, folders: [...folders].sort((left, right) => left.length - right.length) });
}

/** What the run does with one link. */
export interface LinkStep extends DesiredLink {
  /** `unchanged`: already right. `create`: nothing there. `switch`: the installer's own link points elsewhere. `replace`: something that is not the installer's own is there, so it is backed up first. */
  readonly how: 'unchanged' | 'create' | 'switch' | 'replace';
  /** What the path held before the run, in the words of the journal. */
  readonly old: WiringOldContent;
}

/** Why a link cannot be placed. */
export interface Blocked {
  /** The path. */
  readonly path: string;
}

function oldOf(observed: WiringObservation): WiringOldContent {
  if (observed.kind === 'absent') return { state: 'absent' };
  if (observed.kind === 'link') return { state: 'link', target: observed.target };
  return { state: 'real', kind: observed.kind === 'unknown' ? 'other' : observed.kind };
}

/**
 * Decides what to do with one wanted link, given what is at its path and what the last run recorded there.
 *
 * @param wanted - the link the run wants
 * @param observed - what is at the path now, without following a link at its end
 * @param recorded - the install-state entry of the path from the last run, if any
 * @returns the step, or `blocked` when the path holds something that cannot be backed up (a pipe, a device)
 */
export function stepFor(
  wanted: DesiredLink,
  observed: WiringObservation,
  recorded: StateInstallStateEntry | undefined,
): LinkStep | Blocked {
  if (observed.kind === 'other' || observed.kind === 'unknown') return { path: wanted.path };
  const old = oldOf(observed);
  if (observed.kind === 'absent') return { ...wanted, how: 'create', old };
  if (observed.kind === 'link') {
    if (observed.target === wanted.target) return { ...wanted, how: 'unchanged', old };
    const own = recorded !== undefined && recorded.target === observed.target;
    return { ...wanted, how: own ? 'switch' : 'replace', old };
  }
  return { ...wanted, how: 'replace', old };
}

/** What the run does with one generated file. */
export interface WriteStep {
  /** The absolute path. */
  readonly path: string;
  /** The planned file: path below the home, text and hash. */
  readonly file: PlannedGeneratedFile;
  /** True when the file on disk already holds this content and the last run recorded it: nothing is rewritten (FR-026, AC-16.7). */
  readonly unchanged: boolean;
  /** True when a file is there now, so it is backed up before it is replaced. */
  readonly exists: boolean;
}

/** What is known about the generated files before they are written, by path below the home. */
export interface WriteFacts {
  /** The text on disk now; undefined when there is none. */
  readonly onDisk: ReadonlyMap<string, string | undefined>;
  /** The hash the last run recorded; undefined when it recorded none. */
  readonly recorded: ReadonlyMap<string, string | undefined>;
}

/**
 * Decides which generated files need a write.
 *
 * @param files - the files from `planVariablesFiles`
 * @param home - the agent home
 * @param flavor - the path syntax
 * @param facts - what is on disk and what the last run recorded
 * @returns one step per file, in the order given
 */
export function writeSteps(
  files: readonly PlannedGeneratedFile[],
  home: string,
  flavor: PathFlavor,
  facts: WriteFacts,
): readonly WriteStep[] {
  const flavored = path[flavor];
  return files.map((file) => {
    const text = facts.onDisk.get(file.relativePath);
    const same =
      text !== undefined && sha256Hex(text) === file.hash && facts.recorded.get(file.relativePath) === file.hash;
    return {
      path: flavored.join(home, ...file.relativePath.split('/')),
      file,
      unchanged: same,
      exists: text !== undefined,
    };
  });
}

/** A link the run removes: the installer's own link of a component that left the lists, or a retired compatibility link. */
export interface UnlinkStep {
  /** The absolute path of the link. */
  readonly path: string;
  /** The target the installer recorded, which the link must still have. */
  readonly target: string;
  /** The kind the install state recorded. */
  readonly kind: 'symlink' | 'junction';
}

/**
 * Finds the links of the last run that this run no longer wants and that are still the installer's own.
 *
 * @param previous - the entries of the last install state
 * @param keep - every path the run wants to exist
 * @param observed - what is at each previous link path now
 * @returns the links to remove: the path is not wanted, and a link with the recorded target is still there
 */
export function obsoleteLinks(
  previous: readonly StateInstallStateEntry[],
  keep: ReadonlySet<string>,
  observed: ReadonlyMap<string, WiringObservation>,
): readonly UnlinkStep[] {
  return previous.flatMap((entry) => {
    const here = observed.get(entry.path);
    const linkKind = entry.kind === 'symlink' || entry.kind === 'junction' ? entry.kind : undefined;
    const ours = here?.kind === 'link' && entry.target !== undefined && here.target === entry.target;
    return !keep.has(entry.path) && linkKind !== undefined && entry.target !== undefined && ours
      ? [{ path: entry.path, target: entry.target, kind: linkKind }]
      : [];
  });
}

/** The operations of one run. */
export interface InstallPlan {
  /** Folders to make before any link is placed, outermost first. */
  readonly folders: readonly string[];
  /** The generated files. */
  readonly writes: readonly WriteStep[];
  /** The links to place or leave, in order: mounts, the variables link, compatibility links. */
  readonly links: readonly LinkStep[];
  /** The links to remove. */
  readonly unlinks: readonly UnlinkStep[];
  /** The compatibility plan, kept for the report of what was skipped. */
  readonly compat: WiringCompatPlan;
}

/**
 * Tells whether the plan changes anything on disk.
 *
 * @param plan - the operations of the run
 * @returns true when a link is created, switched or replaced, a file is written or a link is removed
 */
export function planChangesDisk(plan: InstallPlan): boolean {
  return (
    plan.links.some((step) => step.how !== 'unchanged') ||
    plan.writes.some((step) => !step.unchanged) ||
    plan.unlinks.length > 0
  );
}
