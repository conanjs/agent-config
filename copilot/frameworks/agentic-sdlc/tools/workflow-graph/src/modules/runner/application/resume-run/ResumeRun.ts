import type { EngineOutcome, RunEngine } from "#src/modules/runner/domain/ports/RunEngine.ts";

/** Continues a stopped run from where its ledger and checkpoint say it is (US2.1, US2.3). */
export class ResumeRun {
  readonly #engine: RunEngine;

  /**
   * Keeps the given collaborators for every later call; nothing runs at construction.
   *
   * @param engine - drives the run
   */
  public constructor(engine: RunEngine) {
    this.#engine = engine;
  }

  /**
   * Returns where the run stopped next.
   *
   * @param project - the main checkout
   * @param run - the run id
   * @returns where the run stopped next
   */
  public run(project: string, run: string): Promise<EngineOutcome> {
    return this.#engine.drive(project, run);
  }
}
