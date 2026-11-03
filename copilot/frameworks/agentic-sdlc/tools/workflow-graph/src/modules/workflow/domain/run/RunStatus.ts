/** Where one task stands, for `status`. */
export type TaskStatus = {
  /** Task id. */
  readonly task: string;
  /** True once review passed. */
  readonly passed: boolean;
  /** Steps the task may take next. */
  readonly next: readonly string[];
  /** Execute attempts so far. */
  readonly attempts: number;
  /** Retries left per budgeted move. */
  readonly retriesLeft: ReadonlyArray<{
    readonly budget: string;
    readonly left: number;
  }>;
};

/** Where a run stands (WG-23): what was last recorded, what may come next, and the open gate's approval reply. */
export type RunStatus = {
  /** Run id. */
  readonly run: string;
  /** P0 path id, once P0 is recorded. */
  readonly path?: string;
  /** Feature folder from the P0 line. */
  readonly feature?: string;
  /** Last recorded step. */
  readonly last?: {
    readonly node: string;
    readonly result: string;
    readonly at: string;
    readonly task?: string;
  };
  /** Nodes allowed next. */
  readonly next: readonly string[];
  /** Open gate and its exact approval reply, when one waits. */
  readonly gate?: {
    readonly id: string;
    readonly reply: string;
  };
  /** Every task with recorded steps. */
  readonly tasks: readonly TaskStatus[];
  /** Ledger errors found; 0 when clean. */
  readonly problems: number;
};
