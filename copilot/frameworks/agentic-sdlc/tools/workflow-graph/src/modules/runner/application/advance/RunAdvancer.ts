import type { Result } from "#src/modules/shared/domain/Result.ts";
import type { CodingAgentRegistry } from "#src/modules/coding-agents/application/CodingAgentRegistry.ts";
import type { RecordStep } from "#src/modules/workflow/application/record-step/RecordStep.ts";
import type {
  LoadedRun,
  RunLoader,
} from "#src/modules/workflow/application/run-loader/RunLoader.ts";
import type { RunStatus } from "#src/modules/workflow/domain/run/RunStatus.ts";
import { LaunchRequest } from "#src/modules/workflow/domain/launch/LaunchRequest.ts";
import { LaunchPrompt } from "#src/modules/runner/domain/LaunchPrompt.ts";
import { RoleReply } from "#src/modules/runner/domain/RoleReply.ts";
import { RunSettings } from "#src/modules/runner/domain/RunSettings.ts";
import { TaskList } from "#src/modules/runner/domain/TaskList.ts";
import type { CheckCommands } from "#src/modules/runner/domain/ports/CheckCommands.ts";
import type { LaunchJournal } from "#src/modules/runner/domain/ports/LaunchJournal.ts";
import type { ProgressReporter } from "#src/modules/runner/domain/ports/ProgressReporter.ts";
import type { RunSettingsStore } from "#src/modules/runner/domain/ports/RunSettingsStore.ts";
import type { Worktrees } from "#src/modules/runner/domain/ports/Worktrees.ts";

/** What one call to {@link RunAdvancer.advance} did. */
export type AdvanceOutcome =
  | { readonly kind: "moved" }
  | { readonly kind: "gate"; readonly gate: string }
  | { readonly kind: "end"; readonly node: string }
  | { readonly kind: "attention"; readonly reason: string };

/** The collaborators the advancer needs. */
export type AdvancerPorts = {
  /** Loads the run, its graph, budgets and tasks. */
  readonly loader: RunLoader;
  /** Records each step as actor runner. */
  readonly record: RecordStep;
  /** Gives each role's agent adapters. */
  readonly registry: CodingAgentRegistry;
  /** Reads the run's settings and the feature's tasks.md. */
  readonly settings: RunSettingsStore;
  /** Remembers each launch's start and end. */
  readonly journal: LaunchJournal;
  /** Creates worktrees, commits and merges task branches. */
  readonly worktrees: Worktrees;
  /** Runs the run's check commands in a task worktree. */
  readonly checks: CheckCommands;
  /** Shows each launch as it starts and ends. */
  readonly progress: ProgressReporter;
};

type Context = {
  readonly project: string;
  readonly run: string;
  readonly loaded: LoadedRun;
  readonly settings: RunSettings;
  readonly status: RunStatus;
};

/** Does the one step the ledger says is open (specs/020 plan, "How one step runs"); every step is recorded through the phase 1 `Run` rules. */
export class RunAdvancer {
  readonly #p: AdvancerPorts;

  /**
   * Keeps the given collaborators for every later call; nothing runs at construction.
   *
   * @param ports - ledger, recording, agents, settings, launch journal, worktrees, checks, progress lines
   */
  public constructor(ports: AdvancerPorts) {
    this.#p = ports;
  }

  /**
   * The node the run is at now, by the ledger: a gate or phase that is open, the step of the task in progress, or an end.
   * @param project - main checkout
   * @param run - run id
   * @returns the node id, or undefined when the run cannot be read
   */
  public async current(project: string, run: string): Promise<string | undefined> {
    const ctx = await this.#context(project, run);
    if (!ctx.ok) return undefined;
    const busy = ctx.value.status.tasks.find((t) => !t.passed && t.next.length > 0);
    return busy !== undefined && ctx.value.status.next.includes("P6")
      ? busy.next[0]
      : ctx.value.status.next[0];
  }

  /**
   * Performs the node's work when it is the current one; a node that is not current does nothing.
   * @param project - main checkout
   * @param run - run id
   * @param node - the graph node the engine is at
   * @returns what happened
   */
  public async advance(project: string, run: string, node: string): Promise<AdvanceOutcome> {
    const ctx = await this.#context(project, run);
    if (!ctx.ok) return { kind: "attention", reason: ctx.error };
    const kind = ctx.value.loaded.graph.kindOf(node);
    if (kind === "end") return { kind: "end", node };
    if (node !== (await this.current(project, run))) return { kind: "moved" };
    if (kind === "gate") return { kind: "gate", gate: node };
    if (kind === "phase" && node !== "P6") return this.#phase(ctx.value, node);
    return this.#p6(ctx.value, node);
  }

  async #context(project: string, run: string): Promise<Result<Context, string>> {
    const loaded = await this.#p.loader.load(project, run);
    if (!loaded.ok) return loaded;
    if (loaded.value.run.broken)
      return { ok: false, error: `the ledger of ${run} has errors; run check-run ${run}` };
    const data = await this.#p.settings.read(project, run);
    if (!data.ok) return data;
    const settings = RunSettings.of(data.value);
    if (!settings.ok) return settings;
    return {
      ok: true,
      value: {
        project,
        run,
        loaded: loaded.value,
        settings: settings.value,
        status: loaded.value.run.status(),
      },
    };
  }

  async #phase(ctx: Context, phase: string): Promise<AdvanceOutcome> {
    const folder = await this.#p.worktrees.ensureRun(ctx.project, ctx.run);
    if (!folder.ok) return { kind: "attention", reason: folder.error };
    const results: string[] = [];
    for (const [i, l] of ctx.loaded.graph.launchesOf(phase).entries()) {
      const key = `${phase}@${ctx.loaded.run.length}#${i}:${l.role}:${l.mode}`;
      const result = await this.#launch(ctx, key, folder.value, {
        role: l.role,
        mode: l.mode,
        phase,
      });
      if (result.kind === "attention") return result;
      results.push(result.result);
    }
    await this.#p.worktrees.commitAll(folder.value, `${ctx.run} ${phase}`);
    return this.#record(ctx, {
      node: phase,
      result: results.every((r) => r === "done") ? "done" : "blocked",
    });
  }

  async #p6(ctx: Context, node: string): Promise<AdvanceOutcome> {
    const runFolder = await this.#p.worktrees.ensureRun(ctx.project, ctx.run);
    if (!runFolder.ok) return { kind: "attention", reason: runFolder.error };
    const feature = ctx.settings.data.feature;
    const tasks = TaskList.read(await this.#p.settings.tasks(runFolder.value, feature));
    const busy = ctx.status.tasks.find((t) => !t.passed && t.next.length > 0);
    const passed = new Set(ctx.status.tasks.filter((t) => t.passed).map((t) => t.task));
    const task = busy === undefined ? tasks.nextReady(passed) : tasks.find(busy.task);
    if (task === undefined)
      return busy === undefined
        ? this.#record(ctx, { node: "P6", result: "done" })
        : { kind: "attention", reason: `task ${busy.task} is not in tasks.md` };
    const step = node === "P6" ? "P6.execute" : node;
    const folder = await this.#p.worktrees.ensureTask(ctx.project, ctx.run, task.id);
    if (!folder.ok) return { kind: "attention", reason: folder.error };
    if (step === "P6.checks")
      return this.#record(ctx, {
        node: step,
        task: task.id,
        result: (await this.#p.checks.run(folder.value, ctx.settings.data.checks))
          ? "pass"
          : "fail",
      });
    const mode = step === "P6.review" ? "review" : "execute";
    const launched = await this.#launch(
      ctx,
      `${task.id}:${step}@${ctx.loaded.run.length}`,
      folder.value,
      { role: task.role, mode, phase: "P6", task: task.id },
    );
    if (launched.kind === "attention") return launched;
    return this.#afterTaskLaunch(ctx, step, task.id, folder.value, launched.result);
  }

  async #afterTaskLaunch(
    ctx: Context,
    step: string,
    task: string,
    folder: string,
    result: string,
  ): Promise<AdvanceOutcome> {
    if (step === "P6.execute") {
      await this.#p.worktrees.commitAll(folder, `${ctx.run} ${task} execute`);
      return this.#record(ctx, {
        node: step,
        task,
        result: result === "done" ? "done" : "blocked",
      });
    }
    if (result === "pass") {
      const merged = await this.#p.worktrees.mergeTask(ctx.project, ctx.run, task);
      if (!merged.ok) return { kind: "attention", reason: merged.error };
    }
    return this.#record(ctx, { node: step, task, result });
  }

  async #launch(
    ctx: Context,
    key: string,
    folder: string,
    what: { role: string; mode: string; phase: string; task?: string },
  ): Promise<
    | { readonly kind: "done"; readonly result: string }
    | { readonly kind: "attention"; readonly reason: string }
  > {
    const known = await this.#p.journal.state(ctx.project, ctx.run, key);
    if (known.kind === "finished") return { kind: "done", result: known.result };
    if (known.kind === "started")
      return {
        kind: "attention",
        reason: `launch ${key} started but has no recorded end; check ${folder}, then remove its line from ${ctx.run}.launches.jsonl to launch it again`,
      };
    const adapters = this.#p.registry.resolve(ctx.settings.agents.agentFor(what.role));
    if (!adapters.ok) return { kind: "attention", reason: `no adapters for ${adapters.error}` };
    const mission = ctx.settings.data.mission;
    const prompt = LaunchPrompt.for({
      run: ctx.run,
      feature: ctx.settings.data.feature,
      ...what,
      ...(mission === undefined ? {} : { mission }),
    });
    // The same rule the chat guard applies (WG-24): never start an agent the run does not allow, e.g. past its budget.
    const request = LaunchRequest.fromPrompt(String(prompt));
    if (request.ok && request.value !== "none") {
      const permit = ctx.loaded.run.permitLaunch(request.value);
      if (!permit.ok) return { kind: "attention", reason: permit.error };
    }
    const agent = String(ctx.settings.agents.agentFor(what.role));
    const label = `${what.task ?? what.phase}: ${what.role} (${what.mode}) in ${agent}`;
    this.#p.progress.note(`${label} … (can take minutes)`);
    const began = Date.now();
    await this.#p.journal.started(ctx.project, ctx.run, key);
    const data = ctx.settings.data;
    const out = await adapters.value.headless.launch({
      prompt: String(prompt),
      role: what.role,
      mode: what.mode,
      cwd: folder,
      maxUsd: data.maxUsdPerLaunch,
      timeoutMs: data.timeoutMinutes * 60_000,
    });
    const result = out.ok ? RoleReply.read(out.value.reply).result : "blocked";
    const seconds = Math.round((Date.now() - began) / 1000);
    this.#p.progress.note(`${label} → ${result} (${seconds} s)${out.ok ? "" : `: ${out.error}`}`);
    await this.#p.journal.finished(ctx.project, ctx.run, key, result);
    return { kind: "done", result };
  }

  async #record(
    ctx: Context,
    step: { node: string; result: string; task?: string },
  ): Promise<AdvanceOutcome> {
    const recorded = await this.#p.record.run({
      project: ctx.project,
      run: ctx.run,
      actor: "runner",
      ...step,
    });
    return recorded.ok
      ? { kind: "moved" }
      : { kind: "attention", reason: `${recorded.error.code} ${recorded.error.message}` };
  }
}
