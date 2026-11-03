import { existsSync } from 'node:fs';
import { appendFile, mkdir, readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { RunRepository } from '#src/modules/workflow/domain/ports/RunRepository.ts';

const TASK = /^\s*- \[[ xX]\] (T\d{3,})\b/gm;

/** Run ledgers as JSON Lines files under `<project>/.specify/runs/`, appended to and never rewritten. */
export class JsonlRunRepository implements RunRepository {
  /** Reads `.specify/runs/<run>.jsonl`. @param project - the project folder @param run - the run id @returns its non-empty lines, or undefined when there is no file */
  public async read(project: string, run: string): Promise<string[] | undefined> {
    const file = this.#file(project, run);
    if (!existsSync(file)) return undefined;
    return (await readFile(file, 'utf8')).split('\n').filter((l) => l.trim() !== '');
  }

  /** Appends one line, creating the folder for a new run. @param project - the project folder @param run - the run id @param line - the JSON line */
  public async append(project: string, run: string, line: string): Promise<void> {
    await mkdir(join(project, '.specify', 'runs'), { recursive: true });
    await appendFile(this.#file(project, run), `${line}\n`);
  }

  /** Lists the runs with a ledger. @param project - the project folder @returns the run ids, sorted */
  public async list(project: string): Promise<string[]> {
    const folder = join(project, '.specify', 'runs');
    if (!existsSync(folder)) return [];
    return (await readdir(folder)).filter((f) => /^R-\d{3,}\.jsonl$/.test(f)).map((f) => f.replace(/\.jsonl$/, '')).sort();
  }

  /** Reads the task ids of a feature's tasks.md. @param project - the project folder @param feature - the feature folder @returns its ids, or undefined when there is no tasks.md */
  public async taskIds(project: string, feature: string): Promise<string[] | undefined> {
    const file = join(project, feature, 'tasks.md');
    if (!existsSync(file)) return undefined;
    return [...(await readFile(file, 'utf8')).matchAll(TASK)].map((m) => String(m[1]));
  }

  #file(project: string, run: string): string {
    return join(project, '.specify', 'runs', `${run}.jsonl`);
  }
}
