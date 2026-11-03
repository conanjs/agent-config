/** Where run ledgers live: `<project>/.specify/runs/<run>.jsonl`, append-only. */
export interface RunRepository {
  /**
   * @param project - the project folder
   * @param run - the run id
   * @returns the ledger's non-empty lines, or undefined when the run has no ledger
   */
  read(project: string, run: string): Promise<string[] | undefined>;
  /**
   * @param project - the project folder
   * @param run - the run id
   * @param line - one JSON line, without the newline
   */
  append(project: string, run: string, line: string): Promise<void>;
  /**
   * @param project - the project folder
   * @returns the ids of every run with a ledger, sorted
   */
  list(project: string): Promise<string[]>;
  /**
   * @param project - the project folder
   * @param feature - the feature folder named on the P0 line, such as `specs/023-cart`
   * @returns the task ids of its tasks.md, or undefined when there is none
   */
  taskIds(project: string, feature: string): Promise<string[] | undefined>;
}
