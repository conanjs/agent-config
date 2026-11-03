import { err, ok, type Result } from '#src/modules/shared/domain/Result.ts';
import type { Finding } from './Finding.ts';
import type { BudgetData, EdgeData, GraphData, NodeData, PathData } from './GraphData.ts';
import { GraphRules } from './GraphRules.ts';
import { GraphShape } from './GraphShape.ts';

/** An allowed move between two nodes, with the budget it counts against, if any. */
export type Move = { readonly from: string; readonly to: string; readonly on: string; readonly budget?: string };

/**
 * The workflow rulebook: which nodes exist and which move may follow which result.
 * Read-only after {@link WorkflowGraph.load}; every query answers from the validated graph.
 */
export class WorkflowGraph {
  readonly #data: GraphData;
  readonly #budgets: ReadonlyMap<string, number>;

  private constructor(data: GraphData, budgets: ReadonlyMap<string, number>) {
    this.#data = data;
    this.#budgets = budgets;
  }

  /**
   * Validates parsed graph data against WG-1 … WG-7 and WG-9 … WG-12.
   * @param data - the parsed YAML or JSON document
   * @param where - file name used in findings
   * @returns the graph, or every finding when it is broken
   */
  public static load(data: unknown, where: string): Result<WorkflowGraph, readonly Finding[]> {
    const shape = new GraphShape(where).check(data);
    if (shape.graph === undefined || shape.findings.length > 0) return err(shape.findings);
    const findings = new GraphRules(shape.graph, where).check();
    if (findings.length > 0) return err(findings);
    const budgets = new Map(Object.entries(shape.graph.budgets).map(([k, b]) => [k, b.default]));
    return ok(new WorkflowGraph(shape.graph, budgets));
  }

  /**
   * Applies a project's own budget table (constitution, "Agentic SDLC budgets") over the defaults.
   * @param overrides - loop budget name to its project value; unknown names are ignored
   * @returns a graph that answers {@link WorkflowGraph.budget} with the project values
   */
  public withBudgets(overrides: ReadonlyMap<string, number>): WorkflowGraph {
    const merged = new Map(this.#budgets);
    for (const [k, v] of overrides) if (merged.has(k)) merged.set(k, v);
    return new WorkflowGraph(this.#data, merged);
  }

  /** @returns the workflow name written into every ledger line as `gen_ai.workflow.name` */
  public get name(): string {
    return this.#data.name;
  }

  /** @returns the framework version the graph belongs to */
  public get version(): string {
    return this.#data.version;
  }

  /** @returns the node every run starts at (P0) */
  public get start(): string {
    return this.#data.start;
  }

  /** @returns the number of nodes, edges and paths, for the check header */
  public get size(): { readonly nodes: number; readonly edges: number; readonly paths: number } {
    return { nodes: Object.keys(this.#data.nodes).length, edges: this.#data.edges.length, paths: this.#data.paths.length };
  }

  /**
   * @param id - a node id
   * @returns the node's kind (`phase`, `gate`, `step`, `end`), or undefined for an unknown id
   */
  public kindOf(id: string): string | undefined {
    return this.#node(id)?.kind;
  }

  /**
   * @param id - a node id
   * @returns true when the node exists in the graph
   */
  public has(id: string): boolean {
    return id in this.#data.nodes;
  }

  /**
   * @param id - a node id
   * @returns true when a script, not an agent, performs the node (`executor: script`), so its lines are written by `script`
   */
  public runByScript(id: string): boolean {
    return this.#node(id)?.executor === 'script';
  }

  /**
   * @param step - a step node id such as `P6.execute`
   * @returns the phase the step belongs to, such as `P6`
   */
  public phaseOf(step: string): string | undefined {
    return this.#node(step)?.of;
  }

  /**
   * @param phase - a phase id
   * @returns true when the phase's `done` must wait for every task (WG-20)
   */
  public joinsAllTasks(phase: string): boolean {
    return this.#node(phase)?.join === 'all-tasks';
  }

  /**
   * Finds the step a launch in `mode` performs inside `phase`, such as review in P6.
   * @param phase - a phase id
   * @param mode - the launch prompt's mode
   * @returns the step id, or undefined when the phase has no step for that mode
   */
  public stepFor(phase: string, mode: string): string | undefined {
    return Object.entries(this.#data.nodes).find(([, n]) => n.of === phase && n.mode === mode)?.[0];
  }

  /**
   * The moves allowed after `from` ended with `result`, for a run on `path`. Falls back to the `otherwise` edge.
   * @param from - the node that just finished
   * @param result - its result
   * @param path - the run's path id (the P0 result); undefined before P0
   * @returns target node id to the move that reaches it
   */
  public movesAfter(from: string, result: string, path: string | undefined): ReadonlyMap<string, Move> {
    const valid = (e: EdgeData): boolean => e.from === from && (e.paths === undefined || (path !== undefined && e.paths.includes(path)));
    const exact = this.#data.edges.filter((e) => valid(e) && e.on === result);
    const chosen = exact.length > 0 ? exact : this.#data.edges.filter((e) => valid(e) && e.on === 'otherwise');
    return new Map(chosen.map((e) => [e.to, this.#move(e)]));
  }

  /**
   * @param name - a loop budget name
   * @returns how many times a move with that budget may be taken, or undefined for an unknown name
   */
  public budget(name: string): number | undefined {
    return this.#budgets.get(name);
  }

  /**
   * @param name - a path id
   * @returns true when the path exists (a valid P0 result)
   */
  public hasPath(name: string): boolean {
    return this.#data.paths.some((p) => p.id === name);
  }

  /**
   * WG-8: owners that are not roles.
   * @param roles - the role ids of `conventions.md` §1
   * @param where - file name used in findings
   * @returns one finding per unknown owner
   */
  public ownersOutside(roles: ReadonlySet<string>, where: string): Finding[] {
    return Object.entries(this.#data.nodes).flatMap(([id, n]) =>
      (n.owner ?? []).filter((o) => !roles.has(o)).map((o) => ({ code: 'WG-8', where, message: `node "${id}": owner "${o}" is not a role in conventions.md §1` })),
    );
  }

  /** @returns the phase nodes in file order, with their table texts */
  public phases(): ReadonlyArray<readonly [string, NodeData]> {
    return Object.entries(this.#data.nodes).filter(([, n]) => n.kind === 'phase');
  }

  /** @returns the P0 classification rows in file order */
  public paths(): readonly PathData[] {
    return this.#data.paths;
  }

  /** @returns the loop budgets with their table texts, in file order */
  public budgets(): ReadonlyArray<readonly [string, BudgetData]> {
    return Object.entries(this.#data.budgets);
  }

  /** @returns the validated graph data, for writing `workflow.graph.json` */
  public toData(): GraphData {
    return this.#data;
  }

  #node(id: string): NodeData | undefined {
    return this.#data.nodes[id];
  }

  #move(e: EdgeData): Move {
    return e.budget === undefined ? { from: e.from, to: e.to, on: e.on } : { from: e.from, to: e.to, on: e.on, budget: e.budget };
  }
}
