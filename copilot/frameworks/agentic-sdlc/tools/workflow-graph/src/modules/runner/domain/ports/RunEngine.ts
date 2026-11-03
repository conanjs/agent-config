/** Where a headless run stopped. */
export type EngineOutcome =
  | { readonly kind: "gate"; readonly gate: string }
  | { readonly kind: "end"; readonly node: string }
  | { readonly kind: "attention"; readonly reason: string };

/** Drives a run through the graph until a gate, an end, or something a person must look at. */
export interface RunEngine {
  /**
   * Returns where the run stopped.
   *
   * @param project - main checkout
   * @param run - run id
   * @returns where the run stopped
   */
  drive(project: string, run: string): Promise<EngineOutcome>;
}
