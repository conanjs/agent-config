// What a finished run records: `components.lock` (what was resolved), `install-state.json` (every path the installer placed, with its
// class, kind and hash, plus the approvals) and the line of `install-log.jsonl`. Pure: the same run always gives the same bytes. The
// entries of a run list every journaled link and write, so a journal left by a kill after the commit is recognised and only deleted
// (commitRun, data-model "Already committed").
import { describeSource } from '#manifests/application/messages/renderManifestMessages.ts';
import type { MergedEntry } from '#manifests/application/ManifestTypes.ts';
import { canonicalJson } from '#shared/domain/hash/canonicalJson.ts';
import type {
  StateComponentsLock,
  StateInstallState,
  StateInstallStateEntry,
  StateLogEntry,
} from '#state/application/StateTypes.ts';
import type { ConsentCheck } from '#wiring/application/privileged/privilegedSet.ts';
import { APPROVAL_PREFIX } from '#commands/application/install/PrivilegedStep.ts';
import type { InstalledComponent, InstallPlan } from '#commands/application/install/PlanInstall.ts';
import type { LoadedComponent } from '#commands/application/install/ReadComponents.ts';

/** What the entries of a run are built from. */
export interface RunRecord {
  /** The agent home. */
  readonly home: string;
  /** The installer that ran. */
  readonly installer: { readonly version: string; readonly commit: string };
  /** The instant of the run, from the Clock port. */
  readonly time: string;
  /** The components of the run. */
  readonly components: readonly InstalledComponent[];
  /** The components that were read, with their list entries. */
  readonly loaded: readonly LoadedComponent[];
  /** The plan that was applied. */
  readonly plan: InstallPlan;
  /** The entries of the last run that stay as they are. */
  readonly carried: readonly StateInstallStateEntry[];
  /** The kind each link became, from the switch (a junction or a copy on Windows), by path. */
  readonly placedKinds: ReadonlyMap<string, 'symlink' | 'junction' | 'copy'>;
  /** The install state of the last run. */
  readonly previous: StateInstallState | undefined;
  /** Components that failed and stay as the last run left them; their commit and lock entry are kept. */
  readonly frozen: readonly string[];
  /** The lock of the last run, the source of the entries of the frozen components. */
  readonly previousLock: StateComponentsLock | undefined;
  /** The privileged set, which is the approved set once the run applies. */
  readonly consent: ConsentCheck;
}

function previousEntry(record: RunRecord, entryPath: string): StateInstallStateEntry | undefined {
  return record.previous?.entries.find((entry) => entry.path === entryPath);
}

/**
 * Lists every path the run placed or keeps, one entry each.
 *
 * @param record - the facts of the run
 * @returns the entries of the new install state, without the approvals
 */
export function placedEntries(record: RunRecord): readonly StateInstallStateEntry[] {
  const links = record.plan.links.map((step): StateInstallStateEntry => {
    const kind = record.placedKinds.get(step.path) ?? previousEntry(record, step.path)?.kind ?? 'symlink';
    return {
      path: step.path,
      class: step.class,
      kind: kind === 'junction' || kind === 'copy' ? kind : 'symlink',
      component: step.component,
      privileged: false,
      target: step.target,
    };
  });
  const files = record.plan.writes.map((step): StateInstallStateEntry => ({
    path: step.path,
    class: 'generated',
    kind: 'file',
    component: 'core',
    privileged: false,
    hash: step.file.hash,
  }));
  return [...links, ...files, ...record.carried];
}

/**
 * Lists the approvals of the run: one entry per member of the privileged set, with the hash V approved (AC-4.6).
 *
 * @param consent - the set the run computed
 * @returns the entries, whose paths start with `privileged:`
 */
export function approvalEntries(consent: ConsentCheck): readonly StateInstallStateEntry[] {
  return consent.entries.map((entry): StateInstallStateEntry => ({
    path: `${APPROVAL_PREFIX}${entry.key}`,
    class: 'generated',
    kind: 'merged-entry',
    component: entry.component,
    privileged: true,
    hash: entry.hash,
  }));
}

function commitOf(component: InstalledComponent): string {
  return component.git?.commit ?? 'live';
}

/** The command and exit code that `last_run` and the log line record. */
export interface RunResult {
  /** The command that ran. */
  readonly command: string;
  /** The exit code it ended with. */
  readonly exit: number;
}

/**
 * Assembles `install-state.json` for the end of a run: the home, every placed path and every approval, and the commit of each component.
 *
 * @param record - the facts of the run
 * @param run - the command and exit code that `last_run` keeps
 * @returns the new install state
 */
export function buildInstallState(record: RunRecord, run: RunResult): StateInstallState {
  return {
    installer: record.installer,
    home: record.home,
    ...(record.consent.entries.length > 0 ? { approved_privileged_hash: record.consent.hash } : {}),
    last_run: { time: record.time, command: run.command, exit: run.exit },
    components: {
      ...Object.fromEntries(
        record.frozen.flatMap((name) =>
          record.previous?.components[name] === undefined ? [] : [[name, record.previous.components[name]]],
        ),
      ),
      ...Object.fromEntries(record.components.map((one) => [one.name, commitOf(one)])),
    },
    entries: [...placedEntries(record), ...approvalEntries(record.consent)],
  };
}

/**
 * Builds `components.lock` of a finished run: what each listed component resolved to, so a plain install stays on it (M-02).
 * Agent-config's own component is not in a list and is not locked.
 *
 * @param record - the facts of the run
 * @returns one entry per listed component that is installed, with its source, resolved commit or live path, and store id
 */
export function buildLock(record: RunRecord): StateComponentsLock {
  const entries = record.loaded.flatMap((one) => {
    const installed = record.components.find((each) => each.name === one.name);
    if (installed === undefined) return [];
    const { source } = one.entry;
    const git = installed.git;
    const listed =
      source.type === 'git'
        ? { type: 'git', url: source.url, ref: source.ref }
        : { type: source.type, path: source.type === 'path' ? source.path : '' };
    const resolved =
      git === undefined
        ? { live: true as const, path: source.type === 'path' ? source.path : '' }
        : { commit: git.commit, ...(git.tag === undefined ? {} : { tag: git.tag }) };
    return [
      [
        one.name,
        {
          source: listed,
          resolved,
          manifest: {
            version: one.manifest.version,
            slot: one.manifest.slot,
            contracts: [...one.manifest.provides.contracts],
          },
          build: null,
          ...(installed.storeId === undefined ? {} : { store_id: installed.storeId }),
        },
      ] as const,
    ];
  });
  const kept = record.frozen.flatMap((name) => {
    const before = record.previousLock?.components[name];
    return before === undefined ? [] : [[name, before] as const];
  });
  return { components: { ...Object.fromEntries(kept), ...Object.fromEntries(entries) } };
}

/**
 * Tells whether two install states differ in anything but the time of the last run, so a run with nothing new rewrites no file (AC-7.1).
 *
 * @param before - the state of the last run
 * @param after - the state the run would write
 * @returns true when they are the same apart from `last_run`
 */
export function sameState(before: StateInstallState | undefined, after: StateInstallState): boolean {
  if (before === undefined) return false;
  // The state file lists its entries sorted by path, so the new list is put in the same order before the two are compared.
  const byPath = (left: StateInstallStateEntry, right: StateInstallStateEntry): number =>
    left.path < right.path ? -1 : left.path > right.path ? 1 : 0;
  const strip = (state: StateInstallState): string =>
    canonicalJson({ ...state, last_run: null, entries: [...state.entries].sort(byPath) });
  return strip(before) === strip(after);
}

/**
 * Tells whether two locks are the same.
 *
 * @param before - the lock of the last run, if there is one
 * @param after - the lock the run would write
 * @returns true when both hold the same components
 */
export function sameLock(before: StateComponentsLock | undefined, after: StateComponentsLock): boolean {
  return before !== undefined && canonicalJson(before.components) === canonicalJson(after.components);
}

/**
 * Builds the line of `install-log.jsonl` for a run (M-16): the components whose commit changed, and the approvals of the run.
 *
 * @param record - the facts of the run
 * @param run - the command and exit code of the run
 * @param approved - the keys of the privileged entries V approved in this run
 * @returns one line of the log, with the components whose commit changed and the approvals
 */
export function buildLogEntry(record: RunRecord, run: RunResult, approved: readonly string[]): StateLogEntry {
  const before = record.previous?.components ?? {};
  const changed = record.components
    .filter((one) => one.origin !== 'core' && before[one.name] !== commitOf(one))
    .map((one) => {
      const entry: MergedEntry | undefined = record.loaded.find((each) => each.name === one.name)?.entry;
      return {
        name: one.name,
        source: entry === undefined ? '' : describeSource(entry.source),
        commit_before: before[one.name] ?? 'none',
        commit_after: commitOf(one),
      };
    });
  return {
    time: record.time,
    command: run.command,
    exit: run.exit,
    components: changed,
    approved_privileged: approved,
  };
}
