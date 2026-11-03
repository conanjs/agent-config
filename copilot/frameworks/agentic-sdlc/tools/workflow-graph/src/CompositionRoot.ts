// Tier B (PDM-class-modeled-R9): the one place that creates concrete adapters and wires them to the use cases.
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { CommandOutput } from "#src/modules/shared/domain/CommandOutput.ts";
import { AgentCapabilities } from "#src/modules/coding-agents/domain/AgentCapabilities.ts";
import {
  CodingAgentRegistry,
  type CodingAgentAdapters,
} from "#src/modules/coding-agents/application/CodingAgentRegistry.ts";
import { VerifyApprovals } from "#src/modules/coding-agents/application/verify-approvals/VerifyApprovals.ts";
import { ClaudeCodeHookDialect } from "#src/modules/coding-agents/infrastructure/claude-code/ClaudeCodeHookDialect.ts";
import { ClaudeCodeSessionLog } from "#src/modules/coding-agents/infrastructure/claude-code/ClaudeCodeSessionLog.ts";
import { CodexHookDialect } from "#src/modules/coding-agents/infrastructure/codex/CodexHookDialect.ts";
import { CodexSessionLog } from "#src/modules/coding-agents/infrastructure/codex/CodexSessionLog.ts";
import { CopilotCliHookDialect } from "#src/modules/coding-agents/infrastructure/copilot-cli/CopilotCliHookDialect.ts";
import { CopilotCliSessionLog } from "#src/modules/coding-agents/infrastructure/copilot-cli/CopilotCliSessionLog.ts";
import { JsonlLog } from "#src/modules/coding-agents/infrastructure/JsonlLog.ts";
import { CommandRunner } from "#src/modules/shared/infrastructure/CommandRunner.ts";
import { ClaudeCodeHeadlessLauncher } from "#src/modules/coding-agents/infrastructure/claude-code/ClaudeCodeHeadlessLauncher.ts";
import { CopilotCliHeadlessLauncher } from "#src/modules/coding-agents/infrastructure/copilot-cli/CopilotCliHeadlessLauncher.ts";
import { CodexHeadlessLauncher } from "#src/modules/coding-agents/infrastructure/codex/CodexHeadlessLauncher.ts";
import type { HeadlessLauncher } from "#src/modules/coding-agents/domain/ports/HeadlessLauncher.ts";
import { FakeHeadlessLauncher } from "#src/modules/runner/infrastructure/FakeHeadlessLauncher.ts";
import { AgentCliHandler } from "#src/modules/coding-agents/interface/cli/AgentCliHandler.ts";
import { HookHandler } from "#src/modules/coding-agents/interface/hooks/HookHandler.ts";
import { CheckGraph } from "#src/modules/workflow/application/check-graph/CheckGraph.ts";
import { CheckRun } from "#src/modules/workflow/application/check-run/CheckRun.ts";
import { CompileGraph } from "#src/modules/workflow/application/compile-graph/CompileGraph.ts";
import { ConventionsTablesPresenter } from "#src/modules/workflow/application/conventions/ConventionsTablesPresenter.ts";
import { GuardLedgerEdit } from "#src/modules/workflow/application/guard-ledger-edit/GuardLedgerEdit.ts";
import { GuardRoleLaunch } from "#src/modules/workflow/application/guard-role-launch/GuardRoleLaunch.ts";
import { ListApprovals } from "#src/modules/workflow/application/list-approvals/ListApprovals.ts";
import { RecordApproval } from "#src/modules/workflow/application/record-approval/RecordApproval.ts";
import { RecordStep } from "#src/modules/workflow/application/record-step/RecordStep.ts";
import { ReportRunStatus } from "#src/modules/workflow/application/report-run-status/ReportRunStatus.ts";
import { FindingsReport } from "#src/modules/workflow/application/report/FindingsReport.ts";
import { RunLoader } from "#src/modules/workflow/application/run-loader/RunLoader.ts";
import { ConstitutionBudgets } from "#src/modules/workflow/infrastructure/ConstitutionBudgets.ts";
import { FrameworkGraphFiles } from "#src/modules/workflow/infrastructure/FrameworkGraphFiles.ts";
import { JsonlRunRepository } from "#src/modules/workflow/infrastructure/JsonlRunRepository.ts";
import { SystemClock } from "#src/modules/workflow/infrastructure/SystemClock.ts";
import { RunStatusPresenter } from "#src/modules/workflow/interface/cli/RunStatusPresenter.ts";
import { WorkflowCliHandler } from "#src/modules/workflow/interface/cli/WorkflowCliHandler.ts";

/** Settings read once from the environment at startup (idiom.config). */
export type Config = {
  /** Framework folder holding the graph files; WORKFLOW_GRAPH_FRAMEWORK or the folder this tool sits in. */
  readonly framework: string;
  /** Fixed ISO time for ledger lines (tests); undefined means the system clock. */
  readonly now: string | undefined;
  /** True when the human set AGENTIC_SDLC_GUARD=off for the harness. */
  readonly guardOff: boolean;
  /** Copilot's folder for session logs: COPILOT_HOME or ~/.copilot. */
  readonly copilotHome: string;
  /** Installed framework home (~/.copilot), where Codex finds role files. */
  readonly agentHome: string;
  /** Executables of the three agents, overridable by WORKFLOW_GRAPH_CLAUDE, _COPILOT and _CODEX. */
  readonly programs: {
    readonly claude: string;
    readonly copilot: string;
    readonly codex: string;
  };
  /** Scripted-replies file for scenarios; when set, every agent's headless launcher is the fake. */
  readonly fakeReplies: string | undefined;
  /** Working folder, the default project for commands without --project. */
  readonly cwd: string;
};

/**
 * Reads the environment once into a frozen config.
 *
 * @param env - the process environment
 * @param cwd - the working folder
 * @returns the frozen settings every handler is built from
 */
export function readConfig(env: NodeJS.ProcessEnv, cwd: string): Config {
  const toolSrc = fileURLToPath(new URL(".", import.meta.url));
  return Object.freeze({
    framework: env["WORKFLOW_GRAPH_FRAMEWORK"] || resolve(toolSrc, "..", "..", ".."),
    now: env["WORKFLOW_GRAPH_NOW"] || undefined,
    guardOff: env["AGENTIC_SDLC_GUARD"] === "off",
    copilotHome: env["COPILOT_HOME"] || join(homedir(), ".copilot"),
    agentHome: join(homedir(), ".copilot"),
    programs: Object.freeze({
      claude: env["WORKFLOW_GRAPH_CLAUDE"] || "claude",
      copilot: env["WORKFLOW_GRAPH_COPILOT"] || "copilot",
      codex: env["WORKFLOW_GRAPH_CODEX"] || "codex",
    }),
    fakeReplies: env["WORKFLOW_GRAPH_FAKE_REPLIES"] || undefined,
    cwd,
  });
}

/**
 * Builds every command handler.
 *
 * @param config - the startup config
 * @returns command name to its runner
 */
export function compose(
  config: Config,
): Map<string, (args: readonly string[], stdin: () => Promise<string>) => Promise<CommandOutput>> {
  const files = new FrameworkGraphFiles(config.framework);
  const runs = new JsonlRunRepository();
  const clock = new SystemClock(config.now);
  const loader = new RunLoader(files, runs, new ConstitutionBudgets());
  const tables = new ConventionsTablesPresenter();
  const checkGraph = new CheckGraph(files, tables);
  const report = new FindingsReport();
  const registry = new CodingAgentRegistry(agents(config));
  const workflow = new WorkflowCliHandler(
    {
      checkGraph,
      compileGraph: new CompileGraph(files, tables, checkGraph),
      recordStep: new RecordStep(loader, runs, clock),
      checkRun: new CheckRun(loader),
      reportStatus: new ReportRunStatus(loader, runs),
    },
    report,
    new RunStatusPresenter(),
    config.cwd,
  );
  const hooks = new HookHandler(
    registry,
    new GuardRoleLaunch(loader, runs, clock, config.guardOff),
    new GuardLedgerEdit(),
    new RecordApproval(loader, runs, clock),
  );
  const agentCli = new AgentCliHandler(
    hooks,
    new VerifyApprovals(new ListApprovals(loader), registry),
    registry,
    report,
    config.cwd,
  );
  const handlers = new Map<
    string,
    (args: readonly string[], stdin: () => Promise<string>) => Promise<CommandOutput>
  >();
  for (const name of workflow.names()) handlers.set(name, (args) => workflow.run(name, args));
  for (const name of agentCli.names())
    handlers.set(name, (args, stdin) => agentCli.run(name, args, stdin));
  const approvals = new RecordApproval(loader, runs, clock);
  handlers.set("run", async (args) => {
    const { runRunner } = await import("#src/RunnerRoot.ts");
    return runRunner(
      {
        graphs: files,
        runs,
        loader,
        record: new RecordStep(loader, runs, clock),
        approvals,
        registry,
        cwd: config.cwd,
      },
      args,
    );
  });
  return handlers;
}

// The capability values are the verified table in specs/019 contracts/coding-agent.md.
function agents(config: Config): ReadonlyMap<string, CodingAgentAdapters> {
  const log = new JsonlLog();
  const runner = new CommandRunner();
  // WORKFLOW_GRAPH_FAKE_REPLIES (scenarios only) swaps every agent's headless launcher for scripted replies.
  const headless = (real: HeadlessLauncher): HeadlessLauncher =>
    config.fakeReplies === undefined ? real : new FakeHeadlessLauncher(config.fakeReplies);
  return new Map<string, CodingAgentAdapters>([
    [
      "claude-code",
      {
        capabilities: new AgentCapabilities({
          canDenySubagentLaunch: true,
          promptHookSeesText: true,
          promptHookCanReply: true,
          repositoryHooksNeedTrustedFolder: false,
          hooksNeedUserTrust: false,
          supportsNamedAgentHeadless: true,
        }),
        hookDialect: new ClaudeCodeHookDialect(),
        sessionLog: new ClaudeCodeSessionLog(log),
        headless: headless(new ClaudeCodeHeadlessLauncher(runner, config.programs.claude)),
      },
    ],
    [
      "copilot-cli",
      {
        capabilities: new AgentCapabilities({
          canDenySubagentLaunch: true,
          promptHookSeesText: true,
          promptHookCanReply: false,
          repositoryHooksNeedTrustedFolder: true,
          hooksNeedUserTrust: false,
          supportsNamedAgentHeadless: true,
        }),
        hookDialect: new CopilotCliHookDialect(config.copilotHome),
        sessionLog: new CopilotCliSessionLog(log),
        headless: headless(new CopilotCliHeadlessLauncher(runner, config.programs.copilot)),
      },
    ],
    [
      "codex",
      {
        capabilities: new AgentCapabilities({
          canDenySubagentLaunch: false,
          promptHookSeesText: true,
          promptHookCanReply: "unknown",
          repositoryHooksNeedTrustedFolder: "unknown",
          hooksNeedUserTrust: true,
          supportsNamedAgentHeadless: false,
        }),
        hookDialect: new CodexHookDialect(),
        sessionLog: new CodexSessionLog(log),
        headless: headless(
          new CodexHeadlessLauncher(runner, config.programs.codex, config.agentHome),
        ),
      },
    ],
  ]);
}
