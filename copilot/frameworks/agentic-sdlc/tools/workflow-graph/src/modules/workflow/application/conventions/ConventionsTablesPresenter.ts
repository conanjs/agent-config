import type { WorkflowGraph } from "#src/modules/workflow/domain/graph/WorkflowGraph.ts";

/** Renders the graph as the three tables conventions.md shows: phases (§5), P0 paths (§5) and loop budgets (§9). */
export class ConventionsTablesPresenter {
  /**
   * Returns block name to its Markdown table, each line ending in a newline.
   *
   * @param graph - the graph to show
   * @returns block name to its Markdown table, each line ending in a newline
   */
  public render(graph: WorkflowGraph): ReadonlyMap<string, string> {
    return new Map([
      ["phases", this.#phases(graph)],
      ["paths", this.#paths(graph)],
      ["budgets", this.#budgets(graph)],
    ]);
  }

  #phases(graph: WorkflowGraph): string {
    const rows = graph
      .phases()
      .map(
        ([id, n]) =>
          `| ${id} ${n.title ?? ""} | ${n["runs-when"] ?? ""} | ${n["owners-text"] ?? ""} | ${n.speckit ?? ""} | ${n.output ?? ""} | ${n["gate-text"] ?? ""} |`,
      );
    return this.#table([
      "| Phase | Runs when | Owner(s) | Spec Kit command | Output | Gate |",
      "|---|---|---|---|---|---|",
      ...rows,
    ]);
  }

  #paths(graph: WorkflowGraph): string {
    const rows = graph.paths().map((p) => `| ${p.when} | ${p["path-text"] ?? p.run.join(" → ")} |`);
    return this.#table(["| Condition | Path |", "|---|---|", ...rows]);
  }

  #budgets(graph: WorkflowGraph): string {
    const rows = graph.budgets().map(([, b]) => `| ${b.loop} | ${b.default} | ${b.exhausted} |`);
    return this.#table(["| Loop | Default budget | When exhausted |", "|---|---|---|", ...rows]);
  }

  #table(lines: readonly string[]): string {
    return `${lines.join("\n")}\n`;
  }
}
