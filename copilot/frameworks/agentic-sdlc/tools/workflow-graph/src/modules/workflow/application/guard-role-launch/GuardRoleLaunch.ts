import { LaunchRequest } from "#src/modules/workflow/domain/launch/LaunchRequest.ts";
import type { Clock } from "#src/modules/workflow/domain/ports/Clock.ts";
import type { RunRepository } from "#src/modules/workflow/domain/ports/RunRepository.ts";
import type { RunLoader } from "#src/modules/workflow/application/run-loader/RunLoader.ts";
import type { GuardOutcome } from "./GuardOutcome.ts";

/** Decides whether a subagent launch may run now (WG-24 … WG-26), or records that it ran with the guard off (WG-22). */
export class GuardRoleLaunch {
  readonly #loader: RunLoader;
  readonly #runs: RunRepository;
  readonly #clock: Clock;
  readonly #guardOff: boolean;

  /**
   * Keeps the given collaborators for every later call; nothing runs at construction.
   *
   * @param loader - loads the run the launch names
   * @param runs - appends the guard-off line
   * @param clock - the guard-off line's time
   * @param guardOff - true when the human set AGENTIC_SDLC_GUARD=off for the harness
   */
  public constructor(loader: RunLoader, runs: RunRepository, clock: Clock, guardOff: boolean) {
    this.#loader = loader;
    this.#runs = runs;
    this.#clock = clock;
    this.#guardOff = guardOff;
  }

  /**
   * Returns no decision when the launch is allowed or names no run; otherwise a deny with the reason.
   *
   * @param project - the folder the agent works in
   * @param prompt - the prompt the subagent tool was given
   * @returns no decision when the launch is allowed or names no run; otherwise a deny with the reason
   */
  public async run(project: string, prompt: string): Promise<GuardOutcome> {
    const parsed = LaunchRequest.fromPrompt(prompt);
    if (!parsed.ok) return { kind: "deny", reason: parsed.error };
    if (parsed.value === "none") return { kind: "no-decision" };
    const launch = parsed.value;
    const loaded = await this.#loader.load(project, launch.run);
    if (!loaded.ok) return { kind: "deny", reason: loaded.error };
    const { run, exists } = loaded.value;
    if (this.#guardOff) {
      if (exists)
        await this.#runs.append(
          project,
          launch.run,
          run.guardOff(launch, this.#clock.now()).entry.toJsonLine(),
        );
      return { kind: "no-decision" };
    }
    if (run.broken)
      return {
        kind: "deny",
        reason: `the ledger of run ${launch.run} has errors; run check-run ${launch.run}`,
      };
    const permit = run.permitLaunch(launch);
    return permit.ok ? { kind: "no-decision" } : { kind: "deny", reason: permit.error };
  }
}
