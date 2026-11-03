/** Runs the run's check commands (the P6 script step) in a task worktree. */
export interface CheckCommands {
  /**
   * Returns true when every command exits 0 (none configured counts as passing).
   *
   * @param folder - the task worktree
   * @param commands - shell commands, run in order
   * @returns true when every command exits 0 (none configured counts as passing)
   */
  run(folder: string, commands: readonly string[]): Promise<boolean>;
}
