import { existsSync } from "node:fs";
import { appendFile, mkdir, readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { RunFolderLayout } from "#src/modules/shared/infrastructure/RunFolderLayout.ts";
import type { RunRepository } from "#src/modules/workflow/domain/ports/RunRepository.ts";

const TASK = /^\s*- \[[ xX]\] (T\d{3,})\b/gm;

/** Run ledgers as JSON Lines files, `<project>/.specify/runs/<run>/ledger.jsonl`, appended to and never rewritten. */
export class JsonlRunRepository implements RunRepository {
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
   * {@link RunRepository.read}: reads `.specify/runs/<run>/ledger.jsonl`.
   */
  public async read(project: string, run: string): Promise<string[] | undefined> {
    const file = this.#file(project, run);
    if (!existsSync(file)) return undefined;
    return (await readFile(file, "utf8")).split("\n").filter((l) => l.trim() !== "");
  }

  /**
   * {@link RunRepository.append}: appends one line, creating the folder for a new run.
   */
  public async append(project: string, run: string, line: string): Promise<void> {
    const file = this.#file(project, run);
    await mkdir(dirname(file), { recursive: true });
    await appendFile(file, `${line}\n`);
  }

  /**
   * {@link RunRepository.list}: lists the runs with a ledger.
   */
  public async list(project: string): Promise<string[]> {
    const folder = this.#layout.root(project);
    if (!existsSync(folder)) return [];
    return (await readdir(folder))
      .filter((name) => this.#layout.isRunId(name) && existsSync(this.#file(project, name)))
      .sort();
  }

  /**
   * {@link RunRepository.taskIds}: reads the task ids of a feature's tasks.md.
   */
  public async taskIds(project: string, feature: string): Promise<string[] | undefined> {
    const file = join(project, feature, "tasks.md");
    if (!existsSync(file)) return undefined;
    return [...(await readFile(file, "utf8")).matchAll(TASK)].map((m) => String(m[1]));
  }

  #file(project: string, run: string): string {
    return this.#layout.ledger(project, run);
  }
}
