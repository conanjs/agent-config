import type { Finding } from "#src/modules/workflow/domain/graph/Finding.ts";
import type { Move, WorkflowGraph } from "#src/modules/workflow/domain/graph/WorkflowGraph.ts";
import type { EntryContent } from "./EntryContent.ts";

/** Where one P6 task stands: the steps it may take next, budget uses, attempts, and whether review passed. */
export type TaskState = {
  /** Steps the task may take next, with the move that opens each. */
  readonly open: Map<string, Move | undefined>;
  /** How often each budgeted move was taken in this task. */
  readonly uses: Map<string, number>;
  /** True once review passed. */
  passed: boolean;
  /** Execute steps taken so far. */
  attempts: number;
  /** Last step and result, for messages. */
  last?: string;
};

/** The node the run reached last, its result and when. */
export type LastStep = {
  /** Node of the last line. */
  readonly node: string;
  /** Its result. */
  readonly result: string;
  /** Its time. */
  readonly at: string;
  /** Its task, for P6 lines. */
  readonly task?: string;
};

/**
 * The run's state machine: decides whether a ledger line may follow the lines before it (WG-17 … WG-21)
 * and moves the run on. One instance replays one run, line by line.
 */
export class RunProgress {
  readonly #graph: WorkflowGraph;
  readonly #taskIds: ReadonlySet<string> | undefined;
  readonly #open = new Map<string, Move | undefined>();
  readonly #runUses = new Map<string, number>();
  readonly #tasks = new Map<string, TaskState>();
  readonly #cursor: { path?: string; feature?: string; started: boolean; last?: LastStep } = {
    started: false,
  };

  /**
   * Starts an empty state machine for one run; lines are fed with admit and apply.
   *
   * @param graph - the rulebook
   * @param taskIds - the task ids of the feature's tasks.md, for the join (WG-20); undefined when unknown
   */
  public constructor(graph: WorkflowGraph, taskIds: readonly string[] | undefined) {
    this.#graph = graph;
    this.#taskIds = taskIds === undefined ? undefined : new Set(taskIds);
  }

  /**
   * Checks whether a line may come next, without changing the run.
   * @param c - the line's content
   * @param where - how findings name the line, such as `R-007 line 4`
   * @returns the first broken rule, or undefined when the line is allowed
   */
  public admit(c: EntryContent, where: string): Finding | undefined {
    if (c.node === "guard-off") return undefined;
    const bad = this.#evidence(c, where) ?? this.#known(c, where);
    if (bad !== undefined) return bad;
    if (!this.#cursor.started) return this.#admitStart(c, where);
    const kind = this.#graph.kindOf(c.node);
    if (kind === "gate" && !(c.actor === "human" && c.quote && c.source && c.session)) {
      return {
        code: "WG-19",
        where,
        message: `${c.node}: a gate result needs a human actor with quote, source and session`,
      };
    }
    return kind === "step" ? this.#admitStep(c, where) : this.#admitRunLevel(c, where);
  }

  /**
   * Moves the run on by one admitted line.
   * @param c - the line's content
   * @param at - the line's time
   */
  public apply(c: EntryContent, at: string): void {
    if (c.node === "guard-off") return;
    if (!this.#cursor.started)
      Object.assign(this.#cursor, { started: true, path: c.result, feature: c.feature });
    this.#cursor.last =
      c.task === undefined
        ? { node: c.node, result: c.result, at }
        : { node: c.node, result: c.result, at, task: c.task };
    if (this.#graph.kindOf(c.node) === "step") this.#applyStep(c);
    else this.#applyRunLevel(c);
  }

  /**
   * Returns the run's path (the P0 result), once P0 is recorded.
   *
   * @returns the run's path (the P0 result), once P0 is recorded
   */
  public get path(): string | undefined {
    return this.#cursor.path;
  }

  /**
   * Returns the feature folder named on the P0 line.
   *
   * @returns the feature folder named on the P0 line
   */
  public get feature(): string | undefined {
    return this.#cursor.feature;
  }

  /**
   * Returns true once the P0 line is recorded.
   *
   * @returns true once the P0 line is recorded
   */
  public get started(): boolean {
    return this.#cursor.started;
  }

  /**
   * Returns the last recorded step.
   *
   * @returns the last recorded step
   */
  public get last(): LastStep | undefined {
    return this.#cursor.last;
  }

  /**
   * Returns the run-level nodes that may come next, with the move that opened each.
   *
   * @returns the run-level nodes that may come next, with the move that opened each
   */
  public get open(): ReadonlyMap<string, Move | undefined> {
    return this.#open;
  }

  /**
   * Returns every task with recorded P6 steps.
   *
   * @returns every task with recorded P6 steps
   */
  public get tasks(): ReadonlyMap<string, TaskState> {
    return this.#tasks;
  }

  /**
   * Returns the task's state, or the state of a task that has not started.
   *
   * @param id - a task id
   * @param phase - the phase the task runs in (P6)
   * @returns the task's state, or the state of a task that has not started
   */
  public task(id: string, phase: string): TaskState {
    return (
      this.#tasks.get(id) ?? {
        open: new Map(this.#graph.movesAfter(phase, "task", this.#cursor.path)),
        uses: new Map(),
        passed: false,
        attempts: 0,
      }
    );
  }

  /**
   * Returns true when taking it once more stays within its budget (WG-18).
   *
   * @param move - a budgeted move
   * @param uses - how often it was taken so far
   * @returns true when taking it once more stays within its budget (WG-18)
   */
  public withinBudget(move: Move | undefined, uses: ReadonlyMap<string, number>): boolean {
    if (move?.budget === undefined) return true;
    return (uses.get(RunProgress.key(move)) ?? 0) < (this.#graph.budget(move.budget) ?? 0);
  }

  /**
   * Returns the key budget uses are counted under.
   *
   * @param move - a move
   * @returns the key budget uses are counted under
   */
  public static key(move: Move): string {
    return `${move.from}>${move.on}>${move.to}`;
  }

  #evidence(c: EntryContent, where: string): Finding | undefined {
    const bad = (c.evidence ?? []).find(
      (p) => p.includes("\n") || p.length > 300 || p.startsWith("/"),
    );
    return bad === undefined
      ? undefined
      : {
          code: "WG-21",
          where,
          message: `evidence "${bad.slice(0, 40)}" is not a single-line relative path of at most 300 characters`,
        };
  }

  #known(c: EntryContent, where: string): Finding | undefined {
    return this.#graph.has(c.node)
      ? undefined
      : { code: "WG-17", where, message: `"${c.node}" is not a node of the graph` };
  }

  #admitStart(c: EntryContent, where: string): Finding | undefined {
    if (c.node === this.#graph.start && this.#graph.hasPath(c.result)) return undefined;
    return {
      code: "WG-17",
      where,
      message: `a run starts with ${this.#graph.start} and a path as its result (got ${c.node} ${c.result})`,
    };
  }

  #admitRunLevel(c: EntryContent, where: string): Finding | undefined {
    if (!this.#open.has(c.node))
      return {
        code: "WG-17",
        where,
        message: `${c.node} cannot follow ${this.#lastText()}; open now: ${this.#openText()}`,
      };
    if (!this.withinBudget(this.#open.get(c.node), this.#runUses)) {
      return {
        code: "WG-18",
        where,
        message: `${c.node}: the "${String(this.#open.get(c.node)?.budget)}" budget is used up`,
      };
    }
    if (c.result === "done" && this.#graph.joinsAllTasks(c.node)) return this.#join(c, where);
    return undefined;
  }

  #join(c: EntryContent, where: string): Finding | undefined {
    if (this.#taskIds === undefined)
      return {
        code: "WG-20",
        where,
        message: `${c.node} done: the run names no feature tasks.md to check every task against`,
      };
    const waiting = [...this.#taskIds].filter((t) => this.#tasks.get(t)?.passed !== true);
    return waiting.length === 0
      ? undefined
      : {
          code: "WG-20",
          where,
          message: `${c.node} done before every task passed review: ${waiting.join(", ")}`,
        };
  }

  #admitStep(c: EntryContent, where: string): Finding | undefined {
    if (c.task === undefined)
      return { code: "WG-15", where, message: `${c.node}: a step line needs its task` };
    const phase = this.#graph.phaseOf(c.node) ?? "";
    if (!this.#open.has(phase))
      return {
        code: "WG-17",
        where,
        message: `${c.node} for ${c.task}: ${phase} is not open; open now: ${this.#openText()}`,
      };
    const task = this.task(c.task, phase);
    if (!task.open.has(c.node)) {
      return {
        code: "WG-17",
        where,
        message: `${c.task}: ${c.node} cannot follow ${task.last ?? "the start of the task"}; next: ${[...task.open.keys()].join(", ") || "none"}`,
      };
    }
    if (!this.withinBudget(task.open.get(c.node), task.uses)) {
      return {
        code: "WG-18",
        where,
        message: `${c.task}: ${c.node} again would exceed the "${String(task.open.get(c.node)?.budget)}" budget`,
      };
    }
    return undefined;
  }

  #applyRunLevel(c: EntryContent): void {
    this.#count(this.#open.get(c.node), this.#runUses);
    this.#replaceOpen(this.#graph.movesAfter(c.node, c.result, this.#cursor.path));
  }

  #applyStep(c: EntryContent): void {
    const phase = this.#graph.phaseOf(c.node) ?? "";
    const task = this.task(String(c.task), phase);
    this.#tasks.set(String(c.task), task);
    this.#count(task.open.get(c.node), task.uses);
    if (this.#graph.stepFor(phase, "execute") === c.node) task.attempts += 1;
    task.last = `${c.node} ${c.result}`;
    const next = this.#graph.movesAfter(c.node, c.result, this.#cursor.path);
    task.open.clear();
    const leaves = new Map<string, Move>();
    for (const [to, move] of next) {
      const kind = this.#graph.kindOf(to);
      if (kind === "step") task.open.set(to, move);
      else if (kind === "end" && to !== "escalate") task.passed = true;
      else leaves.set(to, move);
    }
    if (leaves.size > 0) this.#replaceOpen(leaves);
  }

  #count(move: Move | undefined, uses: Map<string, number>): void {
    if (move?.budget !== undefined)
      uses.set(RunProgress.key(move), (uses.get(RunProgress.key(move)) ?? 0) + 1);
  }

  #replaceOpen(next: ReadonlyMap<string, Move>): void {
    this.#open.clear();
    for (const [to, move] of next) this.#open.set(to, move);
  }

  #lastText(): string {
    const last = this.#cursor.last;
    return last === undefined ? "the start" : `${last.node} ${last.result}`;
  }

  #openText(): string {
    return [...this.#open.keys()].join(", ") || "nothing";
  }
}
