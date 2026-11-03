import { err, ok, type Result } from "#src/modules/shared/domain/Result.ts";
import type { Finding } from "#src/modules/workflow/domain/graph/Finding.ts";
import type { RunLoader } from "#src/modules/workflow/application/run-loader/RunLoader.ts";

/** Replays a whole ledger against the graph and reports every broken rule (WG-15 … WG-22). */
export class CheckRun {
  readonly #loader: RunLoader;

  /**
   * Keeps the given collaborators for every later call; nothing runs at construction.
   *
   * @param loader - loads the run
   */
  public constructor(loader: RunLoader) {
    this.#loader = loader;
  }

  /**
   * Returns every finding, or why the run cannot be checked.
   *
   * @param project - the project folder
   * @param run - the run id
   * @returns every finding, or why the run cannot be checked
   */
  public async run(project: string, run: string): Promise<Result<readonly Finding[], string>> {
    const loaded = await this.#loader.load(project, run);
    if (!loaded.ok) return err(loaded.error);
    if (!loaded.value.exists) return err(`run ${run} has no ledger in ${project}/.specify/runs`);
    return ok(loaded.value.run.findings);
  }
}
