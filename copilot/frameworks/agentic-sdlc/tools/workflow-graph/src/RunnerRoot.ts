// Tier B (PDM-class-modeled-R9): the runner's composition root, imported only by the `run` command, so LangGraph.js
// and its native SQLite module never load in a hook.
import type { CommandOutput } from "#src/modules/shared/domain/CommandOutput.ts";
import type { CodingAgentRegistry } from "#src/modules/coding-agents/application/CodingAgentRegistry.ts";
import { CommandRunner } from "#src/modules/shared/infrastructure/CommandRunner.ts";
import type { RecordApproval } from "#src/modules/workflow/application/record-approval/RecordApproval.ts";
import type { RecordStep } from "#src/modules/workflow/application/record-step/RecordStep.ts";
import type { RunLoader } from "#src/modules/workflow/application/run-loader/RunLoader.ts";
import type { GraphSource } from "#src/modules/workflow/domain/ports/GraphSource.ts";
import type { RunRepository } from "#src/modules/workflow/domain/ports/RunRepository.ts";
import { RunAdvancer } from "#src/modules/runner/application/advance/RunAdvancer.ts";
import { ApproveGate } from "#src/modules/runner/application/approve-gate/ApproveGate.ts";
import { ResumeRun } from "#src/modules/runner/application/resume-run/ResumeRun.ts";
import { StartRun } from "#src/modules/runner/application/start-run/StartRun.ts";
import { FileRunSettingsStore } from "#src/modules/runner/infrastructure/FileRunSettingsStore.ts";
import { GitWorktrees } from "#src/modules/runner/infrastructure/GitWorktrees.ts";
import { JsonlLaunchJournal } from "#src/modules/runner/infrastructure/JsonlLaunchJournal.ts";
import { LangGraphRunEngine } from "#src/modules/runner/infrastructure/LangGraphRunEngine.ts";
import { ShellCheckCommands } from "#src/modules/runner/infrastructure/ShellCheckCommands.ts";
import { TtyHumanConsole } from "#src/modules/runner/infrastructure/TtyHumanConsole.ts";
import { TerminalProgressReporter } from "#src/modules/runner/infrastructure/TerminalProgressReporter.ts";
import { RunCliHandler } from "#src/modules/runner/interface/cli/RunCliHandler.ts";

/** What the main composition root hands the runner. */
export type RunnerParts = {
  /** Loads the compiled workflow graph the runner walks. */
  readonly graphs: GraphSource;
  /** The project's ledgers, read to refuse starting a run that already exists. */
  readonly runs: RunRepository;
  /** Loads a run with its graph, budgets and tasks. */
  readonly loader: RunLoader;
  /** Writes runner steps to the ledger through the phase 1 rules. */
  readonly record: RecordStep;
  /** Records gate decisions typed at the terminal. */
  readonly approvals: RecordApproval;
  /** Each coding agent's adapters, including its headless launcher. */
  readonly registry: CodingAgentRegistry;
  /** Default project folder. */
  readonly cwd: string;
};

/**
 * Builds the runner and runs one `run` sub-command.
 *
 * @param parts - shared use cases and adapters
 * @param args - arguments after `run`
 * @returns what to print
 */
export async function runRunner(
  parts: RunnerParts,
  args: readonly string[],
): Promise<CommandOutput> {
  const graph = await parts.graphs.loadGraph();
  if (!graph.ok)
    return {
      code: 1,
      out: `the workflow graph cannot be used: ${graph.error.map((f) => f.message).join("; ")}`,
    };
  const shell = new CommandRunner();
  const settings = new FileRunSettingsStore();
  const advancer = new RunAdvancer({
    loader: parts.loader,
    record: parts.record,
    registry: parts.registry,
    settings,
    journal: new JsonlLaunchJournal(),
    worktrees: new GitWorktrees(shell),
    checks: new ShellCheckCommands(shell),
    progress: new TerminalProgressReporter(),
  });
  const engine = new LangGraphRunEngine(graph.value, advancer);
  const resume = new ResumeRun(engine);
  const cli = new RunCliHandler(
    {
      start: new StartRun(settings, parts.runs, parts.record, engine),
      resume,
      approve: new ApproveGate(new TtyHumanConsole(), parts.approvals),
    },
    parts.cwd,
  );
  return cli.run(args);
}
