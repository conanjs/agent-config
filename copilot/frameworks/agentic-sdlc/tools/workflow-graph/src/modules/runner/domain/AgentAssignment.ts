import { err, ok, type Result } from "#src/modules/shared/domain/Result.ts";
import { AgentId } from "#src/modules/coding-agents/domain/AgentId.ts";

/** Which coding agent runs each role: one for the run, with per-role overrides (specs/020 D21). */
export class AgentAssignment {
  readonly #fallback: AgentId;
  readonly #overrides: ReadonlyMap<string, AgentId>;

  private constructor(fallback: AgentId, overrides: ReadonlyMap<string, AgentId>) {
    this.#fallback = fallback;
    this.#overrides = overrides;
  }

  /**
   * Returns the assignment, or the first id that names no supported agent.
   *
   * @param fallback - the run's agent id, such as `claude-code`
   * @param overrides - role id to agent id, such as `{ qa: 'copilot-cli' }`
   * @returns the assignment, or the first id that names no supported agent
   */
  public static of(
    fallback: string,
    overrides: Readonly<Record<string, string>>,
  ): Result<AgentAssignment, string> {
    const main = AgentId.parse(fallback);
    if (!main.ok) return err(`"${fallback}" is not claude-code, copilot-cli or codex`);
    const map = new Map<string, AgentId>();
    for (const [role, id] of Object.entries(overrides)) {
      const parsed = AgentId.parse(id);
      if (!parsed.ok) return err(`role ${role}: "${id}" is not claude-code, copilot-cli or codex`);
      map.set(role, parsed.value);
    }
    return ok(new AgentAssignment(main.value, map));
  }

  /**
   * Picks the role's override when one is set, otherwise the run's agent.
   *
   * @param role - a role id
   * @returns the agent that runs it
   */
  public agentFor(role: string): AgentId {
    return this.#overrides.get(role) ?? this.#fallback;
  }

  /**
   * Returns the run's agent and the overrides, as stored in the run's settings.
   *
   * @returns the run's agent and the overrides, as stored in the run's settings
   */
  public toJSON(): {
    readonly agent: string;
    readonly overrides: Readonly<Record<string, string>>;
  } {
    return {
      agent: String(this.#fallback),
      overrides: Object.fromEntries([...this.#overrides].map(([r, a]) => [r, String(a)])),
    };
  }
}
