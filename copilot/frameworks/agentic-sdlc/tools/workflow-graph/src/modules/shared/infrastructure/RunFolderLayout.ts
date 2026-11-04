import { join } from "node:path";

const RUN_ID = /^R-\d{3,}$/;

/**
 * Where one run's files live in a project: one folder per run (spec 021, D49).
 *
 * ```text
 * <project>/.specify/runs/
 * ├── .gitignore            checkpoint databases stay out of git
 * └── R-007/
 *     ├── ledger.jsonl      the run ledger (public)
 *     ├── run.json          the runner's settings (internal)
 *     ├── launches.jsonl    the runner's launch journal (internal)
 *     └── checkpoints.db    LangGraph's checkpoint, with -shm/-wal (internal)
 * ```
 */
export class RunFolderLayout {
  /**
   * Returns the folder that holds every run of a project.
   *
   * @param project - folder of the repository the run belongs to
   * @returns `<project>/.specify/runs`
   */
  public root(project: string): string {
    return join(project, ".specify", "runs");
  }

  /**
   * Returns one run's own folder.
   *
   * @param project - folder of the repository the run belongs to
   * @param run - id such as `R-007`
   * @returns `<project>/.specify/runs/<run>`
   */
  public folder(project: string, run: string): string {
    return join(this.root(project), run);
  }

  /**
   * Returns the run's ledger file.
   *
   * @param project - folder of the repository the run belongs to
   * @param run - id such as `R-007`
   * @returns `<run folder>/ledger.jsonl`
   */
  public ledger(project: string, run: string): string {
    return join(this.folder(project, run), "ledger.jsonl");
  }

  /**
   * Returns the runner's settings file for the run.
   *
   * @param project - folder of the repository the run belongs to
   * @param run - id such as `R-007`
   * @returns `<run folder>/run.json`
   */
  public settings(project: string, run: string): string {
    return join(this.folder(project, run), "run.json");
  }

  /**
   * Returns the runner's launch journal for the run.
   *
   * @param project - folder of the repository the run belongs to
   * @param run - id such as `R-007`
   * @returns `<run folder>/launches.jsonl`
   */
  public launches(project: string, run: string): string {
    return join(this.folder(project, run), "launches.jsonl");
  }

  /**
   * Returns the LangGraph checkpoint database for the run.
   *
   * @param project - folder of the repository the run belongs to
   * @param run - id such as `R-007`
   * @returns `<run folder>/checkpoints.db`
   */
  public checkpoints(project: string, run: string): string {
    return join(this.folder(project, run), "checkpoints.db");
  }

  /**
   * Returns the content of `.specify/runs/.gitignore`, which keeps checkpoint databases out of git.
   *
   * @returns the ignore pattern for every run's checkpoint files
   */
  public gitignore(): string {
    return "*/checkpoints.db*\n";
  }

  /**
   * Tells whether a folder name under the runs root is a run id.
   *
   * @param name - a folder name
   * @returns true for names such as `R-007`
   */
  public isRunId(name: string): boolean {
    return RUN_ID.test(name);
  }
}
