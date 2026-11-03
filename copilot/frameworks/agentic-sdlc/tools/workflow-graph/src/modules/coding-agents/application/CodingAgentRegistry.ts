import { err, ok, type Result } from "#src/modules/shared/domain/Result.ts";
import type { AgentCapabilities } from "#src/modules/coding-agents/domain/AgentCapabilities.ts";
import type { AgentId } from "#src/modules/coding-agents/domain/AgentId.ts";
import type { HeadlessLauncher } from "#src/modules/coding-agents/domain/ports/HeadlessLauncher.ts";
import type { HookDialect } from "#src/modules/coding-agents/domain/ports/HookDialect.ts";
import type { SessionLog } from "#src/modules/coding-agents/domain/ports/SessionLog.ts";

/** Everything that differs for one coding agent. */
export type CodingAgentAdapters = {
  /** What this agent is verified to do; code asks it instead of comparing names. */
  readonly capabilities: AgentCapabilities;
  /** Reads and writes this agent's hook JSON. */
  readonly hookDialect: HookDialect;
  /** Finds the human's typed messages in this agent's session log. */
  readonly sessionLog: SessionLog;
  /** Starts this agent without a chat window for the runner. */
  readonly headless: HeadlessLauncher;
};

/** The one place an agent id selects adapters: a lookup, so no other code branches on the agent's name (plan, "Supporting several coding agents"). */
export class CodingAgentRegistry {
  readonly #entries: ReadonlyMap<string, CodingAgentAdapters>;

  /**
   * Holds the adapters the composition root built, one entry per supported agent.
   *
   * @param entries - agent id to its adapters; built only by the composition root
   */
  public constructor(entries: ReadonlyMap<string, CodingAgentAdapters>) {
    this.#entries = entries;
  }

  /**
   * Returns its adapters, or the id when none are registered.
   *
   * @param id - which coding agent called the hook
   * @returns its adapters, or the id when none are registered
   */
  public resolve(id: AgentId): Result<CodingAgentAdapters, string> {
    const found = this.#entries.get(String(id));
    return found === undefined ? err(String(id)) : ok(found);
  }

  /**
   * Returns the registered agent ids, for usage messages and the contract suite.
   *
   * @returns the registered agent ids, for usage messages and the contract suite
   */
  public ids(): string[] {
    return [...this.#entries.keys()];
  }
}
