/** A capability is verified true or false, or not verified yet; code that needs an unverified one refuses instead of assuming. */
export type Capability = boolean | "unknown";

/** The verified value of each capability one agent has; `unknown` until tested. */
export type CapabilityValues = {
  /** A pre-tool-use hook can refuse a subagent launch. */
  readonly canDenySubagentLaunch: Capability;
  /** The prompt-submit hook receives the typed text. */
  readonly promptHookSeesText: Capability;
  /** The prompt-submit hook's output reaches the agent. */
  readonly promptHookCanReply: Capability;
  /** A project's own hook files run only in a trusted folder. */
  readonly repositoryHooksNeedTrustedFolder: Capability;
  /** Each changed hook must be trusted by the user before it runs. */
  readonly hooksNeedUserTrust: Capability;
  /** A headless run can be started as a named agent (sdlc-<role>). */
  readonly supportsNamedAgentHeadless: Capability;
};

/** What one coding agent can do, as verified (specs/019 contracts/coding-agent.md). Code asks these questions instead of comparing agent names. */
export class AgentCapabilities {
  readonly #values: Readonly<Record<string, Capability>>;

  /**
   * Freezes one agent's verified capability values.
   *
   * @param values - capability name to its verified value
   */
  public constructor(values: CapabilityValues) {
    this.#values = Object.freeze({ ...values });
  }

  /**
   * Returns its verified value, or `unknown`.
   *
   * @param name - a capability name from the constructor
   * @returns its verified value, or `unknown`
   */
  public get(name: string): Capability {
    return this.#values[name] ?? "unknown";
  }
}
