import { err, ok, type Result } from "#src/modules/shared/domain/Result.ts";
import { AgentAssignment } from "./AgentAssignment.ts";

/** The stored form of a run's settings (`.specify/runs/<run>/run.json`). */
export type RunSettingsData = {
  /** Run id, the ledger and worktree name. */
  readonly run: string;
  /** P0 path id, such as new-feature. */
  readonly path: string;
  /** Feature folder under the project, such as specs/023-cart. */
  readonly feature: string;
  /** Agent for every role without an override: claude-code, copilot-cli or codex. */
  readonly agent: string;
  /** Role id to agent id for roles that use another agent. */
  readonly overrides: Readonly<Record<string, string>>;
  /** Shell commands run as the P6 checks, in order; none means checks pass. */
  readonly checks: readonly string[];
  /** Spend cap per launch in US dollars; above 0. */
  readonly maxUsdPerLaunch: number;
  /** Time limit per launch in minutes; above 0. */
  readonly timeoutMinutes: number;
  /** What the run is for, in the human's words; every launch prompt carries it. */
  readonly mission?: string;
};

/** What a headless run was started with: path, feature, agents, check commands, and the per-launch spend and time caps (US4.2). */
export class RunSettings {
  readonly #data: RunSettingsData;
  readonly #agents: AgentAssignment;

  private constructor(data: RunSettingsData, agents: AgentAssignment) {
    this.#data = Object.freeze({ ...data });
    this.#agents = agents;
  }

  /**
   * Returns the settings, or the first invalid field.
   *
   * @param data - settings as given or as stored
   * @returns the settings, or the first invalid field
   */
  public static of(data: RunSettingsData): Result<RunSettings, string> {
    const agents = AgentAssignment.of(data.agent, data.overrides);
    if (!agents.ok) return err(agents.error);
    if (!(data.maxUsdPerLaunch > 0)) return err("the spend cap per launch must be above 0");
    if (!(data.timeoutMinutes > 0)) return err("the time limit per launch must be above 0 minutes");
    return ok(new RunSettings(data, agents.value));
  }

  /**
   * Returns the agent assignment.
   *
   * @returns the agent assignment
   */
  public get agents(): AgentAssignment {
    return this.#agents;
  }

  /**
   * Returns the stored fields.
   *
   * @returns the stored fields
   */
  public get data(): RunSettingsData {
    return this.#data;
  }
}
