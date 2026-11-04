import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { RunFolderLayout } from "#src/modules/shared/infrastructure/RunFolderLayout.ts";
import { err, ok, type Result } from "#src/modules/shared/domain/Result.ts";
import type { RunSettingsData } from "#src/modules/runner/domain/RunSettings.ts";
import type { RunSettingsStore } from "#src/modules/runner/domain/ports/RunSettingsStore.ts";

/** `<project>/.specify/runs/<run>/run.json`; also keeps checkpoint databases out of git with `.specify/runs/.gitignore`. */
export class FileRunSettingsStore implements RunSettingsStore {
  readonly #layout: RunFolderLayout;

  /**
   * Keeps the folder layout that names every run file.
   *
   * @param layout - where each run's files live under `.specify/runs/<run>/`
   */
  public constructor(layout: RunFolderLayout) {
    this.#layout = layout;
  }

  /**
   * {@link RunSettingsStore.write}: also creates `.specify/runs/.gitignore` so checkpoint databases stay out of git.
   */
  public async write(project: string, data: RunSettingsData): Promise<void> {
    const file = this.#layout.settings(project, data.run);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, `${JSON.stringify(data, null, 2)}\n`);
    const ignore = join(this.#layout.root(project), ".gitignore");
    if (!existsSync(ignore)) await writeFile(ignore, this.#layout.gitignore());
  }

  /**
   * {@link RunSettingsStore.read}: parses the JSON without checking it; callers validate it with `RunSettings.of`.
   */
  public async read(project: string, run: string): Promise<Result<RunSettingsData, string>> {
    const file = this.#layout.settings(project, run);
    if (!existsSync(file)) return err(`run ${run} was not started by the runner (no ${file})`);
    return ok(JSON.parse(await readFile(file, "utf8")) as RunSettingsData);
  }

  /**
   * {@link RunSettingsStore.tasks}: reads a feature's tasks.md.
   */
  public async tasks(folder: string, feature: string): Promise<string> {
    const file = join(folder, feature, "tasks.md");
    return existsSync(file) ? readFile(file, "utf8") : "";
  }
}
