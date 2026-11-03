import { err, ok, type Result } from '#src/modules/shared/domain/Result.ts';
import type { Finding } from '#src/modules/workflow/domain/graph/Finding.ts';
import type { Move, WorkflowGraph } from '#src/modules/workflow/domain/graph/WorkflowGraph.ts';
import type { LaunchRequest } from '#src/modules/workflow/domain/launch/LaunchRequest.ts';
import type { Approval } from './Approval.ts';
import type { EntryContent } from './EntryContent.ts';
import { LedgerEntry } from './LedgerEntry.ts';
import type { RunId } from './RunId.ts';
import { RunProgress } from './RunProgress.ts';
import type { RunStatus, TaskStatus } from './RunStatus.ts';

/** Where a human's gate decision came from, written with it (WG-19, WG-30). */
export type ApprovalSource = { readonly source: string; readonly session: string; readonly log?: string };

/** A run and its ledger: the aggregate that owns every rule about which step may come next. Immutable; recording returns a new run. */
export class Run {
  readonly #id: RunId;
  readonly #graph: WorkflowGraph;
  readonly #entries: readonly LedgerEntry[];
  readonly #taskIds: readonly string[] | undefined;
  readonly #progress: RunProgress;
  readonly #findings: readonly Finding[];

  private constructor(id: RunId, graph: WorkflowGraph, entries: readonly LedgerEntry[], taskIds: readonly string[] | undefined, replayed: { progress: RunProgress; findings: Finding[] }) {
    this.#id = id;
    this.#graph = graph;
    this.#entries = entries;
    this.#taskIds = taskIds;
    this.#progress = replayed.progress;
    this.#findings = replayed.findings;
  }

  /**
   * Reads a ledger and replays it against the graph (WG-15 … WG-22).
   * @param id - which run the ledger belongs to (its file name)
   * @param graph - the rulebook
   * @param lines - the ledger's lines, in file order
   * @param taskIds - the feature's task ids, for the join; undefined when unknown
   * @returns the run, with every finding about its ledger
   */
  public static fromLedger(id: RunId, graph: WorkflowGraph, lines: readonly string[], taskIds: readonly string[] | undefined): Run {
    const findings: Finding[] = [];
    const entries: LedgerEntry[] = [];
    for (const [i, line] of lines.entries()) {
      const parsed = LedgerEntry.parse(line);
      if (!parsed.ok) findings.push({ code: 'WG-15', where: `${String(id)} line ${i + 1}`, message: parsed.error });
      else entries.push(parsed.value);
    }
    return Run.#build(id, graph, entries, taskIds, findings);
  }

  static #build(id: RunId, graph: WorkflowGraph, entries: readonly LedgerEntry[], taskIds: readonly string[] | undefined, earlier: Finding[]): Run {
    const progress = new RunProgress(graph, taskIds);
    const findings = [...earlier];
    let previous: LedgerEntry | undefined;
    for (const entry of entries) {
      const where = `${String(id)} line ${entry.seq}`;
      findings.push(...Run.#lineFindings(entry, previous, where, id));
      const broken = progress.admit(entry.content, where);
      if (broken !== undefined) findings.push(broken);
      progress.apply(entry.content, entry.at);
      previous = entry;
    }
    return new Run(id, graph, entries, taskIds, { progress, findings });
  }

  static #lineFindings(entry: LedgerEntry, previous: LedgerEntry | undefined, where: string, id: RunId): Finding[] {
    const out: Finding[] = [];
    const seq = previous === undefined ? 1 : previous.seq + 1;
    if (entry.seq !== seq) out.push({ code: 'WG-15', where, message: `seq is ${entry.seq}, expected ${seq}` });
    if (previous !== undefined && entry.at < previous.at) out.push({ code: 'WG-15', where, message: `at ${entry.at} is earlier than the line before` });
    if (entry.content.run !== String(id)) out.push({ code: 'WG-15', where, message: `run is ${entry.content.run}, not ${String(id)}` });
    if (!entry.chainsAfter(previous)) out.push({ code: 'WG-16', where, message: 'the hash chain is broken here (the line or the one before was changed)' });
    if (entry.content.node === 'guard-off') out.push({ code: 'WG-22', where, message: 'the guard was off for this launch', warning: true });
    return out;
  }

  /** @returns every finding about the ledger, warnings included */
  public get findings(): readonly Finding[] {
    return this.#findings;
  }

  /** @returns true when the ledger has an error (not only warnings) */
  public get broken(): boolean {
    return this.#findings.some((f) => f.warning !== true);
  }

  /**
   * Decides whether a subagent launch may run now (WG-24).
   * @param launch - the launch prompt's keys
   * @returns true, or the reason the launch is refused
   */
  public permitLaunch(launch: LaunchRequest): Result<true, string> {
    const run = String(this.#id);
    const start = this.#graph.start;
    if (!this.#progress.started) return launch.phase === start ? ok(true) : err(`run ${run} has no ${start} line yet; record ${start} first`);
    if (launch.phase === start) return err(`run ${run} is past ${start}`);
    if (this.#graph.kindOf(launch.phase) !== 'phase') return err(`"${launch.phase}" is not a phase of the workflow`);
    if (!this.#progress.open.has(launch.phase)) return err(this.#closedReason(launch.phase));
    const step = this.#graph.stepFor(launch.phase, launch.mode);
    return step === undefined ? ok(true) : this.#permitStep(launch, step);
  }

  #permitStep(launch: LaunchRequest, step: string): Result<true, string> {
    if (launch.task === undefined) return err(`a ${launch.phase} ${launch.mode} launch must name its task (T…)`);
    const task = this.#progress.task(launch.task, launch.phase);
    if (!task.open.has(step)) return err(`task ${launch.task}: ${step} is not next; next: ${[...task.open.keys()].join(', ') || 'nothing (task finished)'}`);
    const move = task.open.get(step);
    if (!this.#progress.withinBudget(move, task.uses)) {
      return err(`task ${launch.task} has used its ${String(this.#graph.budget(String(move?.budget)))} "${String(move?.budget)}" retries; escalate to the human`);
    }
    return ok(true);
  }

  #closedReason(phase: string): string {
    const run = String(this.#id);
    const gate = [...this.#progress.open.keys()].find((n) => this.#graph.kindOf(n) === 'gate');
    if (gate !== undefined) return `${gate} is not approved in run ${run}: reply "approve ${gate} ${run}" to approve`;
    if (this.#progress.open.has('escalate')) return `run ${run} has escalated and needs a human decision`;
    if (this.#progress.open.has('done')) return `run ${run} is finished`;
    return `${phase} is not open in run ${run}; open now: ${[...this.#progress.open.keys()].join(', ')}`;
  }

  /**
   * Records an orchestrator or script step (WG-17 … WG-21). Gate results are refused (WG-19).
   * @param content - the step
   * @param at - ISO time
   * @returns the new run and its new line, or the broken rule
   */
  public record(content: EntryContent, at: string): Result<{ readonly run: Run; readonly entry: LedgerEntry }, Finding> {
    const where = `${String(this.#id)} new line`;
    if (this.#graph.kindOf(content.node) === 'gate' || content.actor === 'human') {
      return err({ code: 'WG-19', where, message: 'gate results are recorded only from the human\'s own message (the approval hook)' });
    }
    const attempt = this.#graph.kindOf(content.node) === 'step' && this.#graph.stepFor(this.#graph.phaseOf(content.node) ?? '', 'execute') === content.node;
    const withAttempt = attempt && content.task !== undefined ? { ...content, attempt: this.#progress.task(content.task, this.#graph.phaseOf(content.node) ?? '').attempts + 1 } : content;
    return this.#append(withAttempt, at, where);
  }

  /**
   * Records a human gate decision when its gate is the open one (WG-28).
   * @param approval - the decision from the human's message
   * @param from - where the message came from
   * @param at - ISO time
   * @returns the new run and line, or why nothing was written
   */
  public approve(approval: Approval, from: ApprovalSource, at: string): Result<{ readonly run: Run; readonly entry: LedgerEntry }, string> {
    if (!this.#progress.open.has(approval.gate)) return err(`${approval.gate} is not the open gate of ${approval.run}`);
    const content: EntryContent = { run: approval.run, node: approval.gate, result: approval.result, actor: 'human', quote: approval.quote, ...from };
    const added = this.#append(content, at, `${String(this.#id)} new line`);
    return added.ok ? added : err(added.error.message);
  }

  /**
   * Records that a launch went through with the guard switched off (WG-22).
   * @param launch - what was launched
   * @param at - ISO time
   * @returns the new run and line
   */
  public guardOff(launch: LaunchRequest, at: string): { readonly run: Run; readonly entry: LedgerEntry } {
    const entry = LedgerEntry.next(this.#entries.at(-1), { run: String(this.#id), node: 'guard-off', result: launch.phase, actor: 'orchestrator', agent: `sdlc-${launch.role}` }, at, this.#graph.name);
    return { run: Run.#build(this.#id, this.#graph, [...this.#entries, entry], this.#taskIds, []), entry };
  }

  #append(content: EntryContent, at: string, where: string): Result<{ readonly run: Run; readonly entry: LedgerEntry }, Finding> {
    const broken = this.#progress.admit(content, where);
    if (broken !== undefined) return err(broken);
    const entry = LedgerEntry.next(this.#entries.at(-1), content, at, this.#graph.name);
    return ok({ run: Run.#build(this.#id, this.#graph, [...this.#entries, entry], this.#taskIds, []), entry });
  }

  /** @returns the human gate lines, for checking each quote against its session log (WG-30) */
  public approvals(): ReadonlyArray<{ readonly seq: number; readonly content: EntryContent }> {
    return this.#entries.filter((e) => e.content.actor === 'human').map((e) => ({ seq: e.seq, content: e.content }));
  }

  /** @returns where the run stands (WG-23) */
  public status(): RunStatus {
    const p = this.#progress;
    const gate = [...p.open.keys()].find((n) => this.#graph.kindOf(n) === 'gate');
    const base = { run: String(this.#id), next: [...p.open.keys()], tasks: [...p.tasks].map(([id, t]) => this.#taskStatus(id, t)), problems: this.#findings.filter((f) => f.warning !== true).length };
    return {
      ...base,
      ...(p.path === undefined ? {} : { path: p.path }),
      ...(p.feature === undefined ? {} : { feature: p.feature }),
      ...(p.last === undefined ? {} : { last: p.last }),
      ...(gate === undefined ? {} : { gate: { id: gate, reply: `approve ${gate} ${String(this.#id)}` } }),
    };
  }

  #taskStatus(id: string, t: { open: ReadonlyMap<string, Move | undefined>; uses: ReadonlyMap<string, number>; passed: boolean; attempts: number }): TaskStatus {
    const retriesLeft = [...t.open.values()]
      .filter((m): m is Move => m?.budget !== undefined)
      .map((m) => ({ budget: String(m.budget), left: (this.#graph.budget(String(m.budget)) ?? 0) - (t.uses.get(RunProgress.key(m)) ?? 0) }));
    return { task: id, passed: t.passed, next: [...t.open.keys()], attempts: t.attempts, retriesLeft };
  }
}
