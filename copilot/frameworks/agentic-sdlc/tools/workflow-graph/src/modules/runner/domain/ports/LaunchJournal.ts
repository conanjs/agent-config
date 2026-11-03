/** What is known about one launch: never started, started with no recorded end, or finished with a graph result. */
export type LaunchState =
  | { readonly kind: "none" }
  | { readonly kind: "started" }
  | { readonly kind: "finished"; readonly result: string };

/** Records each launch's start and end (`<run>.launches.jsonl`), so a crash never repeats a launch blindly (US2.3). */
export interface LaunchJournal {
  /**
   * Returns what is recorded for it.
   *
   * @param project - main checkout
   * @param run - run id
   * @param key - the launch key
   * @returns what is recorded for it
   */
  state(project: string, run: string, key: string): Promise<LaunchState>;
  /**
   * Notes, before the agent starts, that this launch began; a crash after this leaves it unfinished.
   *
   * @param project - main checkout
   * @param run - run id
   * @param key - the launch key
   */
  started(project: string, run: string, key: string): Promise<void>;
  /**
   * Notes the launch's end and its graph result, so a resume reuses the result instead of launching again.
   *
   * @param project - main checkout
   * @param run - run id
   * @param key - the launch key
   * @param result - the graph result it produced
   */
  finished(project: string, run: string, key: string, result: string): Promise<void>;
}
