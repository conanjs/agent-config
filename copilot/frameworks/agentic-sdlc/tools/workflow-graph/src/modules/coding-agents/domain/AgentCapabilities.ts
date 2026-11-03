/** A capability is verified true or false, or not verified yet; code that needs an unverified one refuses instead of assuming. */
export type Capability = boolean | 'unknown';

/** What one coding agent can do, as verified (specs/019 contracts/coding-agent.md). Code asks these questions instead of comparing agent names. */
export class AgentCapabilities {
  readonly #values: Readonly<Record<string, Capability>>;

  /** @param values - capability name to its verified value */
  public constructor(values: {
    canDenySubagentLaunch: Capability;
    promptHookSeesText: Capability;
    promptHookCanReply: Capability;
    repositoryHooksNeedTrustedFolder: Capability;
    hooksNeedUserTrust: Capability;
    supportsNamedAgentHeadless: Capability;
  }) {
    this.#values = Object.freeze({ ...values });
  }

  /**
   * @param name - a capability name from the constructor
   * @returns its verified value, or `unknown`
   */
  public get(name: string): Capability {
    return this.#values[name] ?? 'unknown';
  }
}
