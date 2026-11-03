import type { Result } from "#src/modules/shared/domain/Result.ts";
import type { RunSettingsData } from "#src/modules/runner/domain/RunSettings.ts";

/** Keeps a run's settings (`<run>/run.json`) and reads the files the runner needs from the project. */
export interface RunSettingsStore {
  /**
   * Saves the settings as `.specify/runs/<run>/run.json` in the main checkout, replacing an earlier copy.
   *
   * @param project - main checkout
   * @param data - the settings to keep
   */
  write(project: string, data: RunSettingsData): Promise<void>;
  /**
   * Returns the stored settings, or why there are none.
   *
   * @param project - main checkout
   * @param run - run id
   * @returns the stored settings, or why there are none
   */
  read(project: string, run: string): Promise<Result<RunSettingsData, string>>;
  /**
   * Returns the feature's tasks.md text, empty when missing.
   *
   * @param folder - a checkout or worktree
   * @param feature - the feature folder
   * @returns the feature's tasks.md text, empty when missing
   */
  tasks(folder: string, feature: string): Promise<string>;
}
