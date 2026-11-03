import type { Finding } from "./Finding.ts";
import type { GraphData } from "./GraphData.ts";

const REQUIRED = [
  "schema",
  "name",
  "version",
  "start",
  "budgets",
  "nodes",
  "edges",
  "paths",
] as const;
const KINDS = new Set(["phase", "gate", "step", "end"]);
const ID = /^[A-Za-z][A-Za-z0-9.-]*$/;

/** Checks that parsed graph data has the file shape (WG-1) and valid node ids and kinds (WG-2) before deeper rules run. */
export class GraphShape {
  readonly #where: string;

  /**
   * Names the file every finding of this check will point at.
   *
   * @param where - file name used in findings, such as `workflow.graph.yaml`
   */
  public constructor(where: string) {
    this.#where = where;
  }

  /**
   * Narrows unknown parsed data to the graph type, or lists what is missing.
   * @param data - the parsed YAML or JSON document
   * @returns the typed graph data, or WG-1 and WG-2 findings
   */
  public check(data: unknown): {
    readonly graph?: GraphData;
    readonly findings: readonly Finding[];
  } {
    if (typeof data !== "object" || data === null)
      return { findings: [this.#finding("WG-1", "the file is not a mapping")] };
    const record = data as Record<string, unknown>;
    const missing = REQUIRED.filter(
      (k) => record[k] === undefined || record[k] === null || record[k] === "",
    );
    if (missing.length > 0)
      return { findings: missing.map((k) => this.#finding("WG-1", `missing "${k}"`)) };
    if (record["schema"] !== "workflow-graph/v1") {
      return {
        findings: [
          this.#finding(
            "WG-1",
            `schema must be workflow-graph/v1 (got ${String(record["schema"])})`,
          ),
        ],
      };
    }
    const graph = data as GraphData;
    return { graph, findings: this.#nodeFindings(graph) };
  }

  #nodeFindings(graph: GraphData): Finding[] {
    const out: Finding[] = [];
    for (const [id, node] of Object.entries(graph.nodes)) {
      if (!ID.test(id)) out.push(this.#finding("WG-2", `node id "${id}" is not a valid id`));
      if (!KINDS.has(node.kind))
        out.push(
          this.#finding(
            "WG-2",
            `node "${id}": kind "${node.kind}" is not phase, gate, step or end`,
          ),
        );
    }
    return out;
  }

  #finding(code: string, message: string): Finding {
    return { code, where: this.#where, message };
  }
}
