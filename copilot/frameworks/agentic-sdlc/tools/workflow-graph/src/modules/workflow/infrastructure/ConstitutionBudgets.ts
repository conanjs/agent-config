import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { WorkflowGraph } from '#src/modules/workflow/domain/graph/WorkflowGraph.ts';
import type { ProjectBudgets } from '#src/modules/workflow/domain/ports/ProjectBudgets.ts';

const ROW = /^\|\s*([^|]+?)\s*\|\s*(\d+)\s*\|/;

/** Reads the "Agentic SDLC budgets" table of `.specify/memory/constitution.md`. A row names a budget when its words are a subset of the budget's loop text, or the other way round. */
export class ConstitutionBudgets implements ProjectBudgets {
  /** Matches each table row to a graph budget. @param project - the project folder @param graph - the graph's budgets @returns budget name to the project value */
  public async overrides(project: string, graph: WorkflowGraph): Promise<ReadonlyMap<string, number>> {
    const file = join(project, '.specify', 'memory', 'constitution.md');
    if (!existsSync(file)) return new Map();
    const section = (await readFile(file, 'utf8')).split(/^## /m).find((s) => s.startsWith('Agentic SDLC: budgets')) ?? '';
    const found = new Map<string, number>();
    for (const line of section.split('\n')) {
      const m = ROW.exec(line);
      const name = m === null ? undefined : this.#match(String(m[1]), graph);
      if (m !== null && name !== undefined) found.set(name, Number(m[2]));
    }
    return found;
  }

  #match(cell: string, graph: WorkflowGraph): string | undefined {
    const row = this.#words(cell);
    return graph.budgets().find(([id, b]) => {
      const loop = this.#words(b.loop);
      return id === cell || [...row].every((w) => loop.has(w)) || [...loop].every((w) => row.has(w));
    })?.[0];
  }

  #words(text: string): Set<string> {
    return new Set(text.toLowerCase().replace(/[^a-z0-9-]+/g, ' ').split(' ').filter((w) => w !== ''));
  }
}
