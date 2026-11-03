import { err, ok, type Result } from '#src/modules/shared/domain/Result.ts';
import type { Clock } from '#src/modules/workflow/domain/ports/Clock.ts';
import type { RunRepository } from '#src/modules/workflow/domain/ports/RunRepository.ts';
import type { EntryContent } from '#src/modules/workflow/domain/run/EntryContent.ts';
import type { RunLoader } from '#src/modules/workflow/application/run-loader/RunLoader.ts';

/** One step the Orchestrator reports, as given to `record`. */
export type StepInput = {
  readonly project: string;
  readonly run: string;
  readonly node: string;
  readonly result: string;
  readonly task?: string;
  readonly feature?: string;
  readonly evidence?: readonly string[];
  readonly role?: string;
};

/** Appends one orchestrator or script step to a run's ledger when the graph allows it (WG-17 … WG-21); gate results are refused (WG-19). */
export class RecordStep {
  readonly #loader: RunLoader;
  readonly #runs: RunRepository;
  readonly #clock: Clock;

  /**
   * @param loader - loads the run
   * @param runs - appends the new line
   * @param clock - the line's time
   */
  public constructor(loader: RunLoader, runs: RunRepository, clock: Clock) {
    this.#loader = loader;
    this.#runs = runs;
    this.#clock = clock;
  }

  /**
   * @param input - the run, node, result and optional task, feature, evidence and role reported by the Orchestrator
   * @returns the JSON line written, or the rule id and reason nothing was written
   */
  public async run(input: StepInput): Promise<Result<string, { readonly code: string; readonly message: string }>> {
    const loaded = await this.#loader.load(input.project, input.run);
    if (!loaded.ok) return err({ code: 'WG-17', message: loaded.error });
    const { graph, run } = loaded.value;
    if (run.broken) return err({ code: 'WG-16', message: `the ledger of ${input.run} has errors; run check-run ${input.run}` });
    const content: EntryContent = {
      run: input.run,
      node: input.node,
      result: input.result,
      actor: graph.runByScript(input.node) ? 'script' : 'orchestrator',
      ...(input.task === undefined ? {} : { task: input.task }),
      ...(input.feature === undefined ? {} : { feature: input.feature }),
      ...(input.evidence === undefined ? {} : { evidence: input.evidence }),
      ...(input.role === undefined ? {} : { agent: `sdlc-${input.role}` }),
    };
    const recorded = run.record(content, this.#clock.now());
    if (!recorded.ok) return err(recorded.error);
    const line = recorded.value.entry.toJsonLine();
    await this.#runs.append(input.project, input.run, line);
    return ok(line);
  }
}
