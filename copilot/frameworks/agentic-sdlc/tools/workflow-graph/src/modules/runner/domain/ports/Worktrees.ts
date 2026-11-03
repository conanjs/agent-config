import type { Result } from "#src/modules/shared/domain/Result.ts";

/** The run's git worktrees: one for the run (branch `run/<run>`), one per P6 task (`run/<run>-<task>`) merged back after review. */
export interface Worktrees {
  /**
   * Returns the run worktree's folder, created when missing.
   *
   * @param project - the main checkout
   * @param run - the run id
   * @returns the run worktree's folder, created when missing
   */
  ensureRun(project: string, run: string): Promise<Result<string, string>>;
  /**
   * Returns the task worktree's folder, created when missing.
   *
   * @param project - the main checkout
   * @param run - the run id
   * @param task - the task id
   * @returns the task worktree's folder, created when missing
   */
  ensureTask(project: string, run: string, task: string): Promise<Result<string, string>>;
  /**
   * Returns why committing failed; nothing to commit is fine.
   *
   * @param folder - a worktree
   * @param message - the commit message
   * @returns why committing failed; nothing to commit is fine
   */
  commitAll(folder: string, message: string): Promise<Result<true, string>>;
  /**
   * Returns why the merge into `run/<run>` failed.
   *
   * @param project - the main checkout
   * @param run - the run id
   * @param task - the task id
   * @returns why the merge into `run/<run>` failed
   */
  mergeTask(project: string, run: string, task: string): Promise<Result<true, string>>;
}
