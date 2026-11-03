/** One loop budget as written in the graph file: its default and the two texts of the conventions table. */
export type BudgetData = { readonly default: number; readonly loop: string; readonly exhausted: string };

/** One node as written in the graph file; the display fields feed the generated conventions tables. */
export type NodeData = {
  readonly kind: string;
  readonly title?: string;
  readonly owner?: readonly string[];
  readonly gate?: string;
  readonly of?: string;
  readonly mode?: string;
  readonly executor?: string;
  readonly join?: string;
  readonly 'runs-when'?: string;
  readonly 'owners-text'?: string;
  readonly speckit?: string;
  readonly output?: string;
  readonly 'gate-text'?: string;
};

/** One allowed move: from a node, on a result, to a node; optionally only for some paths and counted against a budget. */
export type EdgeData = {
  readonly from: string;
  readonly to: string;
  readonly on: string;
  readonly budget?: string;
  readonly paths?: readonly string[];
};

/** One P0 classification row: the path id is the P0 line's result. */
export type PathData = { readonly id: string; readonly when: string; readonly run: readonly string[]; readonly 'path-text'?: string };

/** The whole graph file after parsing (`workflow-graph/v1`). */
export type GraphData = {
  readonly schema: string;
  readonly name: string;
  readonly version: string;
  readonly start: string;
  readonly budgets: Readonly<Record<string, BudgetData>>;
  readonly nodes: Readonly<Record<string, NodeData>>;
  readonly edges: readonly EdgeData[];
  readonly paths: readonly PathData[];
};
