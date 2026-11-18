// Step "plan" for the compatibility links: look at the paths, then decide (pure). The observation is one pass over the link paths, the own
// parent folders and Copilot's home; nothing is changed here, so `plan` and a dry run can call it.
import type { PathFlavor } from '#shared/domain/path/PathContainment.ts';
import { compatLinkTable, copilotHomeOf } from '#wiring/domain/compat/CompatLinks.ts';
import { planCompatLinks, type CompatPlan, type Observation } from '#wiring/domain/compat/CompatPlan.ts';
import type { PathObserver } from '#wiring/application/ports/PathObserver.ts';

/** What the plan of compatibility links needs from the run. */
export interface CompatRequest {
  /** The user's home folder. */
  readonly userHome: string;
  /** The agent home. */
  readonly home: string;
  /** The path syntax. */
  readonly flavor: PathFlavor;
  /** The entries of the agent home (relative, `/` separated) that this run puts there; a link is placed only for these. */
  readonly homeEntries: ReadonlySet<string>;
  /** The absolute paths that the release retires; they are not placed again. */
  readonly retired: ReadonlySet<string>;
}

/**
 * Lists the entries of the agent home that a compatibility link points at, so the install can say which of them it puts there.
 *
 * @param userHome - the user's home folder
 * @param home - the agent home
 * @param flavor - the path syntax
 * @returns the home entries in table order, relative to the agent home with `/` separators; a folder or a single file
 */
export function compatHomeEntries(userHome: string, home: string, flavor: PathFlavor): readonly string[] {
  return compatLinkTable(userHome, home, flavor).map((link) => link.homeEntry);
}

/**
 * Plans the compatibility links: which to create, which to switch, which to put in place of a real entry (with a backup), which to
 * leave, and which to skip.
 *
 * @param observer - looks at paths
 * @param request - the homes, the entries the run installs and what the release retires
 * @returns the plan as data
 */
export function planCompat(observer: PathObserver, request: CompatRequest): CompatPlan {
  const table = compatLinkTable(request.userHome, request.home, request.flavor);
  const copilotHome = copilotHomeOf(request.userHome, request.flavor);
  const watched = new Set([
    copilotHome,
    ...table.map((link) => link.path),
    ...table.flatMap((link) => (link.insideOwnFolder === undefined ? [] : [link.insideOwnFolder])),
  ]);
  const observed = new Map<string, Observation>([...watched].map((target) => [target, observer.observe(target)]));
  return planCompatLinks({ table, observed, homeEntries: request.homeEntries, retired: request.retired, copilotHome });
}
