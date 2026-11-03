import type { GuardLedgerEdit } from '#src/modules/workflow/application/guard-ledger-edit/GuardLedgerEdit.ts';
import type { GuardRoleLaunch } from '#src/modules/workflow/application/guard-role-launch/GuardRoleLaunch.ts';
import type { RecordApproval } from '#src/modules/workflow/application/record-approval/RecordApproval.ts';
import type { AgentId } from '#src/modules/coding-agents/domain/AgentId.ts';
import type { GuardDecision, HookDialect } from '#src/modules/coding-agents/domain/ports/HookDialect.ts';
import type { CodingAgentRegistry } from '#src/modules/coding-agents/application/CodingAgentRegistry.ts';

/** Turns one hook call into a use-case call and back: stdin through the agent's dialect, the decision back in the agent's own format. */
export class HookHandler {
  readonly #registry: CodingAgentRegistry;
  readonly #launches: GuardRoleLaunch;
  readonly #edits: GuardLedgerEdit;
  readonly #approvals: RecordApproval;

  /**
   * @param registry - the agents' adapters
   * @param launches - decides subagent launches
   * @param edits - protects the ledgers
   * @param approvals - records gate decisions
   */
  public constructor(registry: CodingAgentRegistry, launches: GuardRoleLaunch, edits: GuardLedgerEdit, approvals: RecordApproval) {
    this.#registry = registry;
    this.#launches = launches;
    this.#edits = edits;
    this.#approvals = approvals;
  }

  /**
   * The pre-tool-use hook (WG-24 … WG-27). Any error becomes a deny: the guard fails closed.
   * @param agent - which agent called
   * @param raw - the hook's stdin
   * @returns the exact stdout for that agent
   */
  public async guard(agent: AgentId, raw: string): Promise<string> {
    const dialect = this.#dialect(agent);
    try {
      return dialect.renderDecision(await this.#decide(dialect, raw));
    } catch (e) {
      return dialect.renderDecision({ kind: 'deny', reason: `the workflow guard failed: ${e instanceof Error ? e.message : String(e)}` });
    }
  }

  /**
   * The prompt-submit hook (WG-28). It records and never blocks, even on errors.
   * @param agent - which agent called
   * @param raw - the hook's stdin
   * @returns the agent's acknowledgement
   */
  public async approve(agent: AgentId, raw: string): Promise<string> {
    const dialect = this.#dialect(agent);
    const prompt = dialect.readSubmittedPrompt(raw);
    if (prompt.ok) {
      const p = prompt.value;
      const from = { source: `${String(agent)}:${p.event}`, session: p.session, ...(p.log === undefined ? {} : { log: p.log }) };
      await this.#approvals.run(p.cwd, p.text, from).catch(() => []);
    }
    return dialect.renderPromptAcknowledgement();
  }

  async #decide(dialect: HookDialect, raw: string): Promise<GuardDecision> {
    const call = dialect.readToolCall(raw);
    if (!call.ok) return { kind: 'deny', reason: `unreadable hook input: ${call.error}` };
    const c = call.value;
    if (c.kind === 'subagent-launch') return this.#launches.run(c.cwd, c.prompt);
    if (c.kind === 'file-write') return this.#edits.run(c.paths);
    return { kind: 'no-decision' };
  }

  #dialect(agent: AgentId): HookDialect {
    const found = this.#registry.resolve(agent);
    if (!found.ok) throw new Error(`no adapters registered for ${found.error}`);
    return found.value.hookDialect;
  }
}
