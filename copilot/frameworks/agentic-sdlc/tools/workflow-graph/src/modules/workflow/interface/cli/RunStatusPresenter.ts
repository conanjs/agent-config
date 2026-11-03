import type { RunStatus, TaskStatus } from '#src/modules/workflow/domain/run/RunStatus.ts';

/** Prints where runs stand in plain words: what the Orchestrator reads at P0 and tells the human (WG-23). */
export class RunStatusPresenter {
  /**
   * @param statuses - one or more runs
   * @param project - the project folder, named when there is no open run
   * @returns the text
   */
  public render(statuses: readonly RunStatus[], project: string): string {
    if (statuses.length === 0) return `No open runs in ${project}`;
    return statuses.map((s) => this.#run(s)).join('\n\n');
  }

  #run(s: RunStatus): string {
    const head = [`Run ${s.run}`, s.path === undefined ? undefined : `path ${s.path}`, s.feature === undefined ? undefined : `feature ${s.feature}`].filter((x) => x !== undefined).join(' · ');
    const lines = [head];
    if (s.last !== undefined) lines.push(`Last: ${s.last.node} ${s.last.result}${s.last.task === undefined ? '' : ` (${s.last.task})`} at ${s.last.at}`);
    if (s.gate !== undefined) lines.push(`Open gate: ${s.gate.id}; reply "${s.gate.reply}" to approve, or "changes ${s.gate.id} ${s.run}" to send it back`);
    lines.push(`Next allowed: ${s.next.join(', ') || 'nothing'}`);
    if (s.tasks.length > 0) lines.push('Tasks:', ...s.tasks.map((t) => this.#task(t)));
    if (s.problems > 0) lines.push(`The ledger has ${s.problems} problem(s): run check-run ${s.run}`);
    return lines.join('\n');
  }

  #task(t: TaskStatus): string {
    if (t.passed) return `  ${t.task} · passed review`;
    const left = t.retriesLeft.map((r) => `${r.budget} ${r.left} left`).join(', ');
    return `  ${t.task} · attempt ${t.attempts} · next ${t.next.join(', ') || 'nothing'}${left === '' ? '' : ` · ${left}`}`;
  }
}
