import { err, ok, type Result } from "#src/modules/shared/domain/Result.ts";
import type { WorkflowGraph } from "#src/modules/workflow/domain/graph/WorkflowGraph.ts";
import type { GraphSource } from "#src/modules/workflow/domain/ports/GraphSource.ts";
import type { ProjectBudgets } from "#src/modules/workflow/domain/ports/ProjectBudgets.ts";
import type { RunRepository } from "#src/modules/workflow/domain/ports/RunRepository.ts";
import { Run } from "#src/modules/workflow/domain/run/Run.ts";
import { RunId } from "#src/modules/workflow/domain/run/RunId.ts";

/** A run loaded with its graph: the project's budgets applied, the ledger replayed, the feature's tasks known. */
export type LoadedRun = {
  /** The graph with the project's budgets applied. */
  readonly graph: WorkflowGraph;
  /** The run replayed from its ledger. */
  readonly run: Run;
  /** False when the run has no ledger file yet. */
  readonly exists: boolean;
};

/** Loads one run for the other use cases: graph, project budgets, ledger, and the task list of the feature named on the P0 line. */
export class RunLoader {
  readonly #graphs: GraphSource;
  readonly #runs: RunRepository;
  readonly #budgets: ProjectBudgets;

  /**
   * Keeps the given collaborators for every later call; nothing runs at construction.
   *
   * @param graphs - the compiled workflow graph
   * @param runs - the project's ledgers
   * @param budgets - the project's own loop budgets
   */
  public constructor(graphs: GraphSource, runs: RunRepository, budgets: ProjectBudgets) {
    this.#graphs = graphs;
    this.#runs = runs;
    this.#budgets = budgets;
  }

  /**
   * Returns the loaded run, or why it cannot be loaded (bad id, unusable graph).
   *
   * @param project - the project folder
   * @param runText - the run id as given
   * @returns the loaded run, or why it cannot be loaded (bad id, unusable graph)
   */
  public async load(project: string, runText: string): Promise<Result<LoadedRun, string>> {
    const id = RunId.parse(runText);
    if (!id.ok) return err(`"${runText}" is not a run id (R- and at least three digits)`);
    const loaded = await this.#graphs.loadGraph();
    if (!loaded.ok)
      return err(
        `the workflow graph cannot be used: ${loaded.error.map((f) => `${f.code} ${f.message}`).join("; ")}`,
      );
    const graph = loaded.value.withBudgets(await this.#budgets.overrides(project, loaded.value));
    const lines = await this.#runs.read(project, runText);
    const first = Run.fromLedger(id.value, graph, lines ?? [], undefined);
    const feature = first.status().feature;
    const tasks = feature === undefined ? undefined : await this.#runs.taskIds(project, feature);
    const run = tasks === undefined ? first : Run.fromLedger(id.value, graph, lines ?? [], tasks);
    return ok({ graph, run, exists: lines !== undefined });
  }
}
