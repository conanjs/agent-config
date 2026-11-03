/** One loop budget as written in the graph file: its default and the two texts of the conventions table. */
export type BudgetData = {
  /** How often the loop may run; whole number, at least 0. */
  readonly default: number;
  /** Loop name in the conventions table. */
  readonly loop: string;
  /** What happens when the budget is used up, for the table. */
  readonly exhausted: string;
};

/** One node as written in the graph file; the display fields feed the generated conventions tables. */
export type NodeData = {
  /** phase, gate, step or end. */
  readonly kind: string;
  /** Short title shown after the phase id in the table. */
  readonly title?: string;
  /** Role ids that own the phase; empty when any relevant role. */
  readonly owner?: readonly string[];
  /** Gate that follows the phase. */
  readonly gate?: string;
  /** For a step: the phase it belongs to. */
  readonly of?: string;
  /** For a step: the launch mode that performs it. */
  readonly mode?: string;
  /** For a step: script when no agent performs it. */
  readonly executor?: string;
  /** all-tasks when the phase's done waits for every task. */
  readonly join?: string;
  /** Roles and modes the headless runner starts for the phase, in order. */
  readonly launches?: ReadonlyArray<{
    readonly role: string;
    readonly mode: string;
  }>;
  /** Table text: when the phase runs. */
  readonly "runs-when"?: string;
  /** Table text: who owns it. */
  readonly "owners-text"?: string;
  /** Table text: the Spec Kit command. */
  readonly speckit?: string;
  /** Table text: what it produces. */
  readonly output?: string;
  /** Table text: its gate. */
  readonly "gate-text"?: string;
};

/** One allowed move: from a node, on a result, to a node; optionally only for some paths and counted against a budget. */
export type EdgeData = {
  /** Node the move leaves. */
  readonly from: string;
  /** Node the move enters. */
  readonly to: string;
  /** Result that selects the move; otherwise matches any other result. */
  readonly on: string;
  /** Loop budget the move counts against; absent when no budget bounds it. */
  readonly budget?: string;
  /** Path ids the move is valid for; absent means every path. */
  readonly paths?: readonly string[];
};

/** One P0 classification row: the path id is the P0 line's result. */
export type PathData = {
  /** Path id; also the result of the P0 line. */
  readonly id: string;
  /** Table text: when the path applies. */
  readonly when: string;
  /** Phases the path runs, in order. */
  readonly run: readonly string[];
  /** Table text replacing the joined phase list. */
  readonly "path-text"?: string;
};

/** The whole graph file after parsing (`workflow-graph/v1`). */
export type GraphData = {
  /** Always workflow-graph/v1. */
  readonly schema: string;
  /** Workflow name, written into ledger lines. */
  readonly name: string;
  /** Framework version the graph belongs to. */
  readonly version: string;
  /** Node every run starts at. */
  readonly start: string;
  /** Loop budgets by name. */
  readonly budgets: Readonly<Record<string, BudgetData>>;
  /** Nodes by id. */
  readonly nodes: Readonly<Record<string, NodeData>>;
  /** Allowed moves. */
  readonly edges: readonly EdgeData[];
  /** P0 classification, first match wins. */
  readonly paths: readonly PathData[];
};
