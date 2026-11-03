/** Where one task stands, for `status`. */
export type TaskStatus = {
  readonly task: string;
  readonly passed: boolean;
  readonly next: readonly string[];
  readonly attempts: number;
  readonly retriesLeft: ReadonlyArray<{ readonly budget: string; readonly left: number }>;
};

/** Where a run stands (WG-23): what was last recorded, what may come next, and the open gate's approval reply. */
export type RunStatus = {
  readonly run: string;
  readonly path?: string;
  readonly feature?: string;
  readonly last?: { readonly node: string; readonly result: string; readonly at: string; readonly task?: string };
  readonly next: readonly string[];
  readonly gate?: { readonly id: string; readonly reply: string };
  readonly tasks: readonly TaskStatus[];
  readonly problems: number;
};
