// pending.ts — scenarios written before their code (specs/022 P6, tests first).
// A scenario whose code does not exist yet carries @pending plus one @Tnnn tag per task that makes it pass.
// - It is skipped (counted in the progress report, so the debt stays visible), unless RUN_PENDING=1:
//   `RUN_PENDING=1 pnpm test --tags @pending` shows what is still red.
// - It fails when it names no task, or when every task it names is ticked [x] in specs/022-repo-split/tasks.md:
//   the task that makes a scenario pass must also remove its @pending tag, so a forgotten tag cannot hide a test.

import fs from 'node:fs';
import path from 'node:path';
import { Before } from '@cucumber/cucumber';
import { repo } from './tools.mjs';

const tasksFile = path.join(repo, 'specs', '022-repo-split', 'tasks.md');

/** Ids of the tasks ticked [x] in tasks.md, read once per run. */
const doneTasks: ReadonlySet<string> = new Set(
  [...fs.readFileSync(tasksFile, 'utf8').matchAll(/^- \[x\] (T\d{3}) /gm)].map((m) => m[1] ?? ''),
);

/** The @Tnnn tags of a scenario, without the @. */
export function taskTags(tags: readonly { name: string }[]): string[] {
  return tags.map((t) => t.name.slice(1)).filter((name) => /^T\d{3}$/.test(name));
}

/** Why a @pending scenario must not be skipped, or null when skipping it is right. */
export function pendingProblem(tasks: readonly string[], done: ReadonlySet<string>): string | null {
  if (tasks.length === 0) return '@pending names no task: add the @Tnnn tag of each task that makes it pass';
  if (tasks.every((t) => done.has(t)))
    return `@pending, but ${tasks.join(', ')} ${tasks.length === 1 ? 'is' : 'are'} done in tasks.md: remove the tag`;
  return null;
}

Before({ tags: '@pending' }, function ({ pickle }) {
  const problem = pendingProblem(taskTags(pickle.tags), doneTasks);
  if (problem) throw new Error(problem);
  return process.env['RUN_PENDING'] === '1' ? undefined : 'skipped';
});
