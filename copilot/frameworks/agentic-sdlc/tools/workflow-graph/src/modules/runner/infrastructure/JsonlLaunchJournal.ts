import { existsSync } from "node:fs";
import { appendFile, mkdir, readFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { RunFolderLayout } from "#src/modules/shared/infrastructure/RunFolderLayout.ts";
import type { LaunchJournal, LaunchState } from "#src/modules/runner/domain/ports/LaunchJournal.ts";

/** `<project>/.specify/runs/<run>/launches.jsonl`: one `started` and one `finished` line per launch key. */
export class JsonlLaunchJournal implements LaunchJournal {
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
   * {@link LaunchJournal.state}: reads the whole `<run>/launches.jsonl`; a finished line wins over a started one.
   */
  public async state(project: string, run: string, key: string): Promise<LaunchState> {
    const file = this.#file(project, run);
    if (!existsSync(file)) return { kind: "none" };
    const lines = (await readFile(file, "utf8"))
      .split("\n")
      .filter((l) => l.trim() !== "")
      .map((l) => JSON.parse(l) as { key: string; event: string; result?: string });
    const mine = lines.filter((l) => l.key === key);
    const end = mine.find((l) => l.event === "finished");
    if (end !== undefined) return { kind: "finished", result: end.result ?? "blocked" };
    return mine.length > 0 ? { kind: "started" } : { kind: "none" };
  }

  /**
   * {@link LaunchJournal.started}: appends a `started` line, creating the run folder when missing.
   */
  public async started(project: string, run: string, key: string): Promise<void> {
    await this.#append(project, run, { key, event: "started" });
  }

  /**
   * {@link LaunchJournal.finished}: appends a `finished` line carrying the result.
   */
  public async finished(project: string, run: string, key: string, result: string): Promise<void> {
    await this.#append(project, run, { key, event: "finished", result });
  }

  async #append(project: string, run: string, line: Record<string, string>): Promise<void> {
    const file = this.#file(project, run);
    await mkdir(dirname(file), { recursive: true });
    await appendFile(file, `${JSON.stringify(line)}\n`);
  }

  #file(project: string, run: string): string {
    return this.#layout.launches(project, run);
  }
}
