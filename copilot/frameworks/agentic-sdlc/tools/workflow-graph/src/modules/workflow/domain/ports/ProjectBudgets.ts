import type { WorkflowGraph } from "#src/modules/workflow/domain/graph/WorkflowGraph.ts";

/** A project's own loop budgets: the "Agentic SDLC budgets" table of its constitution. */
export interface ProjectBudgets {
  /**
   * Returns budget name to the project's value; empty when the project sets none.
   *
   * @param project - the project folder
   * @param graph - the graph whose budget names the table is matched against
   * @returns budget name to the project's value; empty when the project sets none
   */
  overrides(project: string, graph: WorkflowGraph): Promise<ReadonlyMap<string, number>>;
}
