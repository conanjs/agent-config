import { err, ok, type Result } from '#src/modules/shared/domain/Result.ts';
import type { Finding } from '#src/modules/workflow/domain/graph/Finding.ts';
import type { ListApprovals } from '#src/modules/workflow/application/list-approvals/ListApprovals.ts';
import { AgentId } from '#src/modules/coding-agents/domain/AgentId.ts';
import type { CodingAgentRegistry } from '#src/modules/coding-agents/application/CodingAgentRegistry.ts';

/** Confirms each human gate line of a run quotes a message really typed in that session (WG-30). The agent is read from the line's `source` (`<agent>:<event>`). */
export class VerifyApprovals {
  readonly #approvals: ListApprovals;
  readonly #registry: CodingAgentRegistry;

  /**
   * @param approvals - lists a run's human lines
   * @param registry - gives each agent's session log reader
   */
  public constructor(approvals: ListApprovals, registry: CodingAgentRegistry) {
    this.#approvals = approvals;
    this.#registry = registry;
  }

  /**
   * @param project - the project folder
   * @param run - the run id
   * @returns one finding per approval that cannot be confirmed, or why the run cannot be read
   */
  public async run(project: string, run: string): Promise<Result<readonly Finding[], string>> {
    const listed = await this.#approvals.run(project, run);
    if (!listed.ok) return err(listed.error);
    const findings: Finding[] = [];
    for (const { seq, content } of listed.value) {
      const where = `${run} line ${seq}`;
      const id = AgentId.parse((content.source ?? '').split(':')[0] ?? '');
      const adapters = id.ok ? this.#registry.resolve(id.value) : err('');
      if (!adapters.ok) {
        findings.push({ code: 'WG-30', where, message: `source "${content.source ?? ''}" names no known agent` });
        continue;
      }
      const ref = content.log === undefined ? { session: content.session ?? '' } : { session: content.session ?? '', log: content.log };
      const found = await adapters.value.sessionLog.containsUserMessage(ref, content.quote ?? '');
      if (!found.ok) findings.push({ code: 'WG-30', where, message: found.error });
      else if (!found.value) findings.push({ code: 'WG-30', where, message: `the quote of ${content.node} is not a message typed in session ${content.session ?? ''}` });
    }
    return ok(findings);
  }
}
