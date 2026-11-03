import { err, ok, type Result } from '#src/modules/shared/domain/Result.ts';
import type { EntryContent } from '#src/modules/workflow/domain/run/EntryContent.ts';
import type { RunLoader } from '#src/modules/workflow/application/run-loader/RunLoader.ts';

/** One human gate line, for checking its quote against the session log (WG-30). */
export type RecordedApproval = { readonly seq: number; readonly content: EntryContent };

/** Lists a run's human gate lines. */
export class ListApprovals {
  readonly #loader: RunLoader;

  /** @param loader - loads the run */
  public constructor(loader: RunLoader) {
    this.#loader = loader;
  }

  /**
   * @param project - the project folder
   * @param run - the run id
   * @returns the human lines in ledger order, or why the run cannot be read
   */
  public async run(project: string, run: string): Promise<Result<readonly RecordedApproval[], string>> {
    const loaded = await this.#loader.load(project, run);
    if (!loaded.ok) return err(loaded.error);
    if (!loaded.value.exists) return err(`run ${run} has no ledger in ${project}/.specify/runs`);
    return ok(loaded.value.run.approvals());
  }
}
