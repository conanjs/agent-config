import { err, ok, type Result } from "#src/modules/shared/domain/Result.ts";
import type { RunRepository } from "#src/modules/workflow/domain/ports/RunRepository.ts";
import type { RunStatus } from "#src/modules/workflow/domain/run/RunStatus.ts";
import type { RunLoader } from "#src/modules/workflow/application/run-loader/RunLoader.ts";

/** Says where runs stand (WG-23): one run in detail, or every open run of a project. */
export class ReportRunStatus {
  readonly #loader: RunLoader;
  readonly #runs: RunRepository;

  /**
   * Keeps the given collaborators for every later call; nothing runs at construction.
   *
   * @param loader - loads each run
   * @param runs - lists the project's runs
   */
  public constructor(loader: RunLoader, runs: RunRepository) {
    this.#loader = loader;
    this.#runs = runs;
  }

  /**
   * Returns the statuses, or why they cannot be read.
   *
   * @param project - the project folder
   * @param run - one run id, or undefined for every open run
   * @returns the statuses, or why they cannot be read
   */
  public async run(
    project: string,
    run: string | undefined,
  ): Promise<Result<readonly RunStatus[], string>> {
    const ids = run === undefined ? await this.#runs.list(project) : [run];
    const statuses: RunStatus[] = [];
    for (const id of ids) {
      const loaded = await this.#loader.load(project, id);
      if (!loaded.ok) return err(loaded.error);
      if (!loaded.value.exists) return err(`run ${id} has no ledger in ${project}/.specify/runs`);
      const status = loaded.value.run.status();
      if (run !== undefined || !status.next.every((n) => n === "done")) statuses.push(status);
    }
    return ok(statuses);
  }
}
