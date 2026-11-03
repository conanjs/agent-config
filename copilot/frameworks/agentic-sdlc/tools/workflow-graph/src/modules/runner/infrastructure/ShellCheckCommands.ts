import type { CommandRunner } from "#src/modules/shared/infrastructure/CommandRunner.ts";
import type { CheckCommands } from "#src/modules/runner/domain/ports/CheckCommands.ts";

/** Runs each check command with `/bin/sh -c` in the task worktree, ten minutes at most each. */
export class ShellCheckCommands implements CheckCommands {
  readonly #shell: CommandRunner;

  /**
   * Keeps the given collaborators for every later call; nothing runs at construction.
   *
   * @param shell - runs the commands
   */
  public constructor(shell: CommandRunner) {
    this.#shell = shell;
  }

  /**
   * {@link CheckCommands.run}: stops at the first failing command.
   */
  public async run(folder: string, commands: readonly string[]): Promise<boolean> {
    for (const command of commands)
      if (!(await this.#shell.run("/bin/sh", ["-c", command], folder, 600_000)).ok) return false;
    return true;
  }
}
