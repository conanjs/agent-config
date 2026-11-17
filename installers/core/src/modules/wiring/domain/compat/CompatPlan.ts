// DR-306, AC-7.3, AC-8.1, AC-8.2: the plan of compatibility links as data. Pure: it reads what is at each path (handed in as an
// observation) and decides create, switch, replace, leave or skip; the state module's ports carry the plan out at apply time.
import type { CompatLink } from '#wiring/domain/compat/CompatLinks.ts';

/** What is at a path now, as the observer saw it without following a link at its end. */
export type Observation =
  | { readonly kind: 'absent' }
  | { readonly kind: 'link'; readonly target: string }
  | { readonly kind: 'folder' | 'file' | 'other' }
  | { readonly kind: 'unknown' };

/** What the path held before the run, in the words of the journal (`backed-up` is for T138 to fill in after the backup). */
export type OldContent =
  | { readonly state: 'absent' }
  | { readonly state: 'link'; readonly target: string }
  | { readonly state: 'real'; readonly kind: 'folder' | 'file' | 'other' };

/** One link that the run must create, switch or put in place of a real entry. */
export interface CompatOperation {
  /** The kind of operation. */
  readonly op: 'link';
  /** The absolute path of the link. */
  readonly path: string;
  /** The absolute target in the agent home. */
  readonly target: string;
  /** How the install state records it. */
  readonly class: 'compat';
  /** The owning component. */
  readonly component: 'core';
  /** A compatibility link is never privileged. */
  readonly privileged: false;
  /** What the path held before the run. */
  readonly old: OldContent;
  /** True when what is there must be copied to the backups folder first (a real entry, or a link that points somewhere else). */
  readonly backup: boolean;
}

/** Why a link was not placed. */
export type SkipReason =
  'target-not-installed' | 'copilot-folder-missing' | 'copilot-folder-not-real' | 'cannot-observe' | 'retired';

/** What the plan of compatibility links says. */
export interface CompatPlan {
  /** The links to create or switch, in table order. */
  readonly operations: readonly CompatOperation[];
  /** Paths already holding the right link, which the run leaves untouched. */
  readonly unchanged: readonly string[];
  /** Links not placed, with the reason. */
  readonly skipped: readonly { readonly path: string; readonly reason: SkipReason }[];
  /** Folders that must exist before a link is placed in them: Copilot's home when it is missing. Never one that Copilot owns. */
  readonly ensureFolders: readonly string[];
}

/** What the planner needs besides the table. */
export interface CompatPlanInput {
  /** The links of the agent home. */
  readonly table: readonly CompatLink[];
  /** What each link path, each own parent folder and Copilot's home hold now, by absolute path. */
  readonly observed: ReadonlyMap<string, Observation>;
  /** The names (relative to the agent home, `/` separated) that this run puts in the agent home. */
  readonly homeEntries: ReadonlySet<string>;
  /** Paths the release retires (compat.yaml); they are not placed. */
  readonly retired: ReadonlySet<string>;
  /** The folder of Copilot's home. */
  readonly copilotHome: string;
}

const ABSENT: Observation = { kind: 'absent' };

function oldOf(seen: Observation): OldContent {
  if (seen.kind === 'absent') return { state: 'absent' };
  if (seen.kind === 'link') return { state: 'link', target: seen.target };
  return { state: 'real', kind: seen.kind === 'unknown' ? 'other' : seen.kind };
}

// A link that goes inside a folder Copilot owns is placed only when that folder is a real folder now.
function parentProblem(
  link: CompatLink,
  observed: ReadonlyMap<string, Observation>,
): 'copilot-folder-missing' | 'copilot-folder-not-real' | undefined {
  if (link.insideOwnFolder === undefined) return undefined;
  const parent = observed.get(link.insideOwnFolder) ?? ABSENT;
  if (parent.kind === 'absent') return 'copilot-folder-missing';
  return parent.kind === 'folder' ? undefined : 'copilot-folder-not-real';
}

type LinkDecision =
  | { readonly kind: 'skip'; readonly reason: SkipReason }
  | { readonly kind: 'unchanged' }
  | { readonly kind: 'operation'; readonly operation: CompatOperation };

// Why a link is not placed, in the order of the rules: retired, Copilot's home is not a folder, nothing to link to, the own folder is
// missing or not real, the path cannot be seen.
function skipReasonOf(
  link: CompatLink,
  input: CompatPlanInput,
  copilot: Observation,
  seen: Observation,
): SkipReason | undefined {
  if (input.retired.has(link.path)) return 'retired';
  if (copilot.kind === 'file' || copilot.kind === 'other') return 'copilot-folder-not-real';
  if (!input.homeEntries.has(link.homeEntry)) return 'target-not-installed';
  return parentProblem(link, input.observed) ?? (seen.kind === 'unknown' ? 'cannot-observe' : undefined);
}

// The decision for one link: skip it, leave it, or create / switch / replace it.
function decideLink(link: CompatLink, input: CompatPlanInput, copilot: Observation): LinkDecision {
  const seen = input.observed.get(link.path) ?? ABSENT;
  const skipReason = skipReasonOf(link, input, copilot, seen);
  if (skipReason !== undefined) return { kind: 'skip', reason: skipReason };
  if (seen.kind === 'link' && seen.target === link.target) return { kind: 'unchanged' };
  return {
    kind: 'operation',
    operation: {
      op: 'link',
      path: link.path,
      target: link.target,
      class: 'compat',
      component: 'core',
      privileged: false,
      old: oldOf(seen),
      backup: seen.kind !== 'absent',
    },
  };
}

/**
 * Decides, for each compatibility link, whether to create it, switch it, put it in place of a real entry, leave it, or skip it.
 *
 * A real file or folder, or a link that points somewhere else, is replaced and marked for backup (AC-7.3); nothing is replaced for a
 * path Copilot owns, because the table holds none except the one file link inside the instructions folder, and that one needs the
 * folder to exist as a real folder already (AC-8.2). A target the run does not put in the agent home is not linked, so no link
 * dangles.
 *
 * @param input - the table, the observations, what the run installs and what the release retires
 * @returns the operations to carry out, the paths already right, the paths skipped and the folders to ensure
 */
export function planCompatLinks(input: CompatPlanInput): CompatPlan {
  const operations: CompatOperation[] = [];
  const unchanged: string[] = [];
  const skipped: { path: string; reason: SkipReason }[] = [];
  const copilot = input.observed.get(input.copilotHome) ?? ABSENT;
  for (const link of input.table) {
    const decision = decideLink(link, input, copilot);
    if (decision.kind === 'skip') skipped.push({ path: link.path, reason: decision.reason });
    else if (decision.kind === 'unchanged') unchanged.push(link.path);
    else operations.push(decision.operation);
  }
  return {
    operations,
    unchanged,
    skipped,
    ensureFolders: operations.length > 0 && copilot.kind === 'absent' ? [input.copilotHome] : [],
  };
}
