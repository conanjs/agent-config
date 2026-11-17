import type { Result } from '#shared/domain/result/Result.ts';
import type { CompatRequest } from '#wiring/application/compat/planCompat.ts';
import type { RetiredRequest } from '#wiring/application/compat/planRetired.ts';
import type { ConsentCheck, ConsentRequest } from '#wiring/application/privileged/privilegedSet.ts';
import type { PrivilegedLines } from '#wiring/application/privileged/describePrivileged.ts';
import type { PathFlavor } from '#shared/domain/path/PathContainment.ts';
import type {
  WiringCompatPlan,
  WiringPrivilegedEntry,
  WiringPrivilegedRefusal,
  WiringRetiredDecision,
  WiringRetiredEntry,
} from '#wiring/application/WiringTypes.ts';

/**
 * What the wiring module offers the commands in phase 2: the plan of compatibility links, the retired list and its decisions, and the
 * privileged set with its consent diff. Built by `composeWiring` in WiringModule.ts and handed to the commands by the composition root.
 */
export interface WiringApi {
  /**
   * Plans the compatibility links: create, switch, back up and replace, leave or skip, as data. Changes nothing.
   *
   * @param request - the homes, the entries the run puts in the agent home and what the release retires
   * @returns the plan
   */
  planCompat(request: CompatRequest): WiringCompatPlan;

  /**
   * Reads `compat.yaml` of the agent-config checkout.
   *
   * @param text - the file, or `undefined` when there is none
   * @param userHome - the user's home folder
   * @param flavor - the path syntax
   * @returns the retired entries, or one sentence for MG-23
   */
  readRetiredList(
    text: string | undefined,
    userHome: string,
    flavor: PathFlavor,
  ): Result<readonly WiringRetiredEntry[], string>;

  /**
   * Decides every retired path: remove the installer's own link, leave what is not its own, keep a link a hook command names.
   *
   * @param request - the list and the compatibility links the install state recorded
   * @returns one decision per entry
   */
  planRetired(request: RetiredRequest): WiringRetiredDecision[];

  /**
   * Writes the MG-19 report lines of the retired decisions.
   *
   * @param decisions - what `planRetired` decided
   * @returns `retired:`, `left:` and `kept:` lines in list order; a path that is gone prints nothing
   */
  renderRetired(decisions: readonly WiringRetiredDecision[]): string[];

  /**
   * Computes the privileged set and diffs it against what V approved (M-01).
   *
   * @param request - the components, the recorded approvals and the homes
   * @returns the set, its hash and the diff, or the refusals that stop the run
   */
  checkPrivileged(request: ConsentRequest): Result<ConsentCheck, readonly WiringPrivilegedRefusal[]>;

  /**
   * Writes the item and detail line of an entry through the message catalogue.
   *
   * @param entry - an entry of the set
   * @returns the lines of the MG-09 block that the entry decides
   */
  describePrivileged(entry: WiringPrivilegedEntry): PrivilegedLines;
}
