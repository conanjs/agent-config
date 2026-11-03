import { existsSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { err, ok, type Result } from "#src/modules/shared/domain/Result.ts";
import type { CommandRunner } from "#src/modules/shared/infrastructure/CommandRunner.ts";
import type { Worktrees } from "#src/modules/runner/domain/ports/Worktrees.ts";

const IDENTITY = ["-c", "user.name=workflow-runner", "-c", "user.email=workflow-runner@localhost"];

/** Worktrees beside the project: `<project>.runs/<run>` on `run/<run>`, `<project>.runs/<run>-<task>` on `run/<run>-<task>`. */
export class GitWorktrees implements Worktrees {
  readonly #git: CommandRunner;

  /**
   * Keeps the given collaborators for every later call; nothing runs at construction.
   *
   * @param git - runs git
   */
  public constructor(git: CommandRunner) {
    this.#git = git;
  }

  /**
   * {@link Worktrees.ensureRun}: creates the run worktree from the project's HEAD when missing.
   */
  public async ensureRun(project: string, run: string): Promise<Result<string, string>> {
    const folder = join(dirname(project), `${basename(project)}.runs`, run);
    if (existsSync(folder)) return ok(folder);
    const made = await this.#git.run(
      "git",
      ["-C", project, "worktree", "add", "-q", "-b", `run/${run}`, folder],
      project,
      60_000,
    );
    return made.ok ? ok(folder) : err(made.error);
  }

  /**
   * {@link Worktrees.ensureTask}: creates a task worktree from `run/<run>` when missing.
   */
  public async ensureTask(
    project: string,
    run: string,
    task: string,
  ): Promise<Result<string, string>> {
    const runFolder = await this.ensureRun(project, run);
    if (!runFolder.ok) return runFolder;
    const folder = join(dirname(project), `${basename(project)}.runs`, `${run}-${task}`);
    if (existsSync(folder)) return ok(folder);
    const made = await this.#git.run(
      "git",
      ["-C", runFolder.value, "worktree", "add", "-q", "-b", `run/${run}-${task}`, folder],
      project,
      60_000,
    );
    return made.ok ? ok(folder) : err(made.error);
  }

  /**
   * {@link Worktrees.commitAll}: commits every change in a worktree; nothing to commit is not an error.
   */
  public async commitAll(folder: string, message: string): Promise<Result<true, string>> {
    const added = await this.#git.run("git", ["-C", folder, "add", "-A"], folder, 60_000);
    if (!added.ok) return added;
    const unchanged = await this.#git.run(
      "git",
      ["-C", folder, "diff", "--cached", "--quiet"],
      folder,
      60_000,
    );
    if (unchanged.ok) return ok(true);
    const done = await this.#git.run(
      "git",
      [...IDENTITY, "-C", folder, "commit", "-q", "-m", message],
      folder,
      60_000,
    );
    return done.ok ? ok(true) : done;
  }

  /**
   * {@link Worktrees.mergeTask}: merges a passed task into `run/<run>` and removes its worktree; the branch stays.
   */
  public async mergeTask(
    project: string,
    run: string,
    task: string,
  ): Promise<Result<true, string>> {
    const runFolder = await this.ensureRun(project, run);
    if (!runFolder.ok) return runFolder;
    const merged = await this.#git.run(
      "git",
      [
        ...IDENTITY,
        "-C",
        runFolder.value,
        "merge",
        "-q",
        "--no-ff",
        "-m",
        `${run}: merge ${task}`,
        `run/${run}-${task}`,
      ],
      project,
      60_000,
    );
    if (!merged.ok) return merged;
    const taskFolder = join(dirname(project), `${basename(project)}.runs`, `${run}-${task}`);
    const removed = await this.#git.run(
      "git",
      ["-C", project, "worktree", "remove", "--force", taskFolder],
      project,
      60_000,
    );
    return removed.ok ? ok(true) : removed;
  }
}
