import { parseArgs } from "node:util";
import type { CommandOutput } from "#src/modules/shared/domain/CommandOutput.ts";
import type { ApproveGate } from "#src/modules/runner/application/approve-gate/ApproveGate.ts";
import type { ResumeRun } from "#src/modules/runner/application/resume-run/ResumeRun.ts";
import type { StartRun } from "#src/modules/runner/application/start-run/StartRun.ts";
import type { EngineOutcome } from "#src/modules/runner/domain/ports/RunEngine.ts";

/** The use cases the `run` commands call. */
export type RunCommands = {
  /** Starts a new run. */
  readonly start: StartRun;
  /** Continues a stopped run. */
  readonly resume: ResumeRun;
  /** Records a decision typed at the terminal. */
  readonly approve: ApproveGate;
};

const USAGE = [
  'usage: run start <run> --path <path id> --feature <folder> [--mission "<text>"] --agent <claude-code|copilot-cli|codex> [--role-agent <role>=<agent>]… [--check "<cmd>"]… [--max-usd <n>] [--timeout-minutes <n>] [--project <dir>]',
  '       run approve <run> <gate> "<your words>" [--changes] [--project <dir>]',
  "       run resume <run> [--project <dir>]",
].join("\n");

/** `run start | approve | resume`: the headless runner's command line (specs/020 FR-003). */
export class RunCliHandler {
  readonly #commands: RunCommands;
  readonly #cwd: string;

  /**
   * Keeps the given collaborators for every later call; nothing runs at construction.
   *
   * @param commands - the runner use cases
   * @param cwd - the default project folder
   */
  public constructor(commands: RunCommands, cwd: string) {
    this.#commands = commands;
    this.#cwd = cwd;
  }

  /**
   * Parses and runs one `run` sub-command.
   *
   * @param args - the arguments after `run`
   * @returns what to print and the exit code
   */
  public async run(args: readonly string[]): Promise<CommandOutput> {
    const { values, positionals } = parseArgs({
      args: [...args],
      allowPositionals: true,
      options: RunCliHandler.#options,
    });
    const [sub, run = "", ...rest] = positionals;
    const project = values.project ?? this.#cwd;
    if (sub === "resume") return this.#show(run, await this.#commands.resume.run(project, run));
    if (sub === "approve") return this.#approve(project, run, rest, values.changes === true);
    if (
      sub !== "start" ||
      values.path === undefined ||
      values.feature === undefined ||
      values.agent === undefined
    )
      return { code: 2, out: USAGE };
    const overrides = Object.fromEntries(
      (values["role-agent"] ?? []).map((pair) => pair.split("=") as [string, string]),
    );
    const started = await this.#commands.start.run(project, {
      run,
      path: values.path,
      feature: values.feature,
      agent: values.agent,
      overrides,
      checks: values.check ?? [],
      maxUsdPerLaunch: Number(values["max-usd"] ?? "2"),
      timeoutMinutes: Number(values["timeout-minutes"] ?? "30"),
      ...(values.mission === undefined ? {} : { mission: values.mission }),
    });
    return started.ok ? this.#show(run, started.value) : { code: 1, out: started.error };
  }

  static readonly #options = {
    project: { type: "string" },
    path: { type: "string" },
    feature: { type: "string" },
    agent: { type: "string" },
    "role-agent": { type: "string", multiple: true },
    check: { type: "string", multiple: true },
    "max-usd": { type: "string" },
    "timeout-minutes": { type: "string" },
    changes: { type: "boolean" },
    mission: { type: "string" },
  } as const;

  async #approve(
    project: string,
    run: string,
    rest: readonly string[],
    changes: boolean,
  ): Promise<CommandOutput> {
    const [gate = "", ...words] = rest;
    const decision = `${changes ? "changes" : "approve"} ${gate} ${run} ${words.join(" ")}`.trim();
    const recorded = await this.#commands.approve.run(project, decision, gate);
    if (!recorded.ok) return { code: 1, out: recorded.error };
    return this.#show(run, await this.#commands.resume.run(project, run));
  }

  #show(run: string, outcome: EngineOutcome): CommandOutput {
    if (outcome.kind === "gate") {
      return {
        code: 0,
        out: `Run ${run} stopped at ${outcome.gate}. To approve: workflow-graph run approve ${run} ${outcome.gate} "<your words>" (or type "approve ${outcome.gate} ${run}" in a chat session, then: workflow-graph run resume ${run})`,
      };
    }
    if (outcome.kind === "end")
      return outcome.node === "done"
        ? { code: 0, out: `Run ${run} finished.` }
        : {
            code: 1,
            out: `Run ${run} stopped at ${outcome.node}: it needs a person (workflow-graph status ${run}).`,
          };
    return { code: 1, out: `Run ${run} needs attention: ${outcome.reason}` };
  }
}
