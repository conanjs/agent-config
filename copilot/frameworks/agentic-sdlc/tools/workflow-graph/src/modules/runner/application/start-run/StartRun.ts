import { err, type Result } from "#src/modules/shared/domain/Result.ts";
import type { RecordStep } from "#src/modules/workflow/application/record-step/RecordStep.ts";
import type { RunRepository } from "#src/modules/workflow/domain/ports/RunRepository.ts";
import { RunSettings, type RunSettingsData } from "#src/modules/runner/domain/RunSettings.ts";
import type { EngineOutcome, RunEngine } from "#src/modules/runner/domain/ports/RunEngine.ts";
import type { RunSettingsStore } from "#src/modules/runner/domain/ports/RunSettingsStore.ts";

/** Starts a headless run: keeps its settings, records P0 with the path and feature, then drives it to the first stop (US1.1). */
export class StartRun {
  readonly #settings: RunSettingsStore;
  readonly #runs: RunRepository;
  readonly #record: RecordStep;
  readonly #engine: RunEngine;

  /**
   * Keeps the given collaborators for every later call; nothing runs at construction.
   *
   * @param settings - keeps the run's settings
   * @param runs - tells whether the run already has a ledger
   * @param record - records the P0 line
   * @param engine - drives the run
   */
  public constructor(
    settings: RunSettingsStore,
    runs: RunRepository,
    record: RecordStep,
    engine: RunEngine,
  ) {
    this.#settings = settings;
    this.#runs = runs;
    this.#record = record;
    this.#engine = engine;
  }

  /**
   * Returns where the run stopped, or why it could not start.
   *
   * @param project - the main checkout
   * @param data - the run's settings
   * @returns where the run stopped, or why it could not start
   */
  public async run(project: string, data: RunSettingsData): Promise<Result<EngineOutcome, string>> {
    const settings = RunSettings.of(data);
    if (!settings.ok) return settings;
    if ((await this.#runs.read(project, data.run)) !== undefined)
      return err(`run ${data.run} already has a ledger; use run resume ${data.run}`);
    await this.#settings.write(project, data);
    const p0 = await this.#record.run({
      project,
      run: data.run,
      node: "P0",
      result: data.path,
      feature: data.feature,
      actor: "runner",
    });
    if (!p0.ok) return err(`${p0.error.code} ${p0.error.message}`);
    return { ok: true, value: await this.#engine.drive(project, data.run) };
  }
}
