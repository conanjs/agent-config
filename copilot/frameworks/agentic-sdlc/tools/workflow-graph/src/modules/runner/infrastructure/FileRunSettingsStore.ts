import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { err, ok, type Result } from "#src/modules/shared/domain/Result.ts";
import type { RunSettingsData } from "#src/modules/runner/domain/RunSettings.ts";
import type { RunSettingsStore } from "#src/modules/runner/domain/ports/RunSettingsStore.ts";

/** `<project>/.specify/runs/<run>.run.json`; also keeps checkpoint databases out of git with `.specify/runs/.gitignore`. */
export class FileRunSettingsStore implements RunSettingsStore {
  /**
   * {@link RunSettingsStore.write}: also creates `.specify/runs/.gitignore` so checkpoint databases stay out of git.
   */
  public async write(project: string, data: RunSettingsData): Promise<void> {
    const folder = join(project, ".specify", "runs");
    await mkdir(folder, { recursive: true });
    await writeFile(join(folder, `${data.run}.run.json`), `${JSON.stringify(data, null, 2)}\n`);
    if (!existsSync(join(folder, ".gitignore")))
      await writeFile(join(folder, ".gitignore"), "*.checkpoints.db*\n");
  }

  /**
   * {@link RunSettingsStore.read}: parses the JSON without checking it; callers validate it with `RunSettings.of`.
   */
  public async read(project: string, run: string): Promise<Result<RunSettingsData, string>> {
    const file = join(project, ".specify", "runs", `${run}.run.json`);
    if (!existsSync(file))
      return err(`run ${run} was not started by the runner (no ${run}.run.json)`);
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
