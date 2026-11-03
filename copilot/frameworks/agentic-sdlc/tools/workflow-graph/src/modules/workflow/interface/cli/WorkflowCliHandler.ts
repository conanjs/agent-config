import { parseArgs } from 'node:util';
import type { CommandOutput } from '#src/modules/shared/domain/CommandOutput.ts';
import type { CheckGraph } from '#src/modules/workflow/application/check-graph/CheckGraph.ts';
import type { CheckRun } from '#src/modules/workflow/application/check-run/CheckRun.ts';
import type { CompileGraph } from '#src/modules/workflow/application/compile-graph/CompileGraph.ts';
import type { RecordStep } from '#src/modules/workflow/application/record-step/RecordStep.ts';
import type { FindingsReport } from '#src/modules/workflow/application/report/FindingsReport.ts';
import type { ReportRunStatus } from '#src/modules/workflow/application/report-run-status/ReportRunStatus.ts';
import type { RunStatusPresenter } from './RunStatusPresenter.ts';

/** The use cases the workflow commands call. */
export type WorkflowCommands = {
  readonly checkGraph: CheckGraph;
  readonly compileGraph: CompileGraph;
  readonly recordStep: RecordStep;
  readonly checkRun: CheckRun;
  readonly reportStatus: ReportRunStatus;
};

/** The command line of the workflow module: check-graph, compile-graph, record, check-run, status (specs/019 contracts/cli.md). */
export class WorkflowCliHandler {
  readonly #commands: WorkflowCommands;
  readonly #report: FindingsReport;
  readonly #status: RunStatusPresenter;
  readonly #cwd: string;

  /**
   * @param commands - the use cases
   * @param report - prints findings
   * @param status - prints run status
   * @param cwd - the default project folder
   */
  public constructor(commands: WorkflowCommands, report: FindingsReport, status: RunStatusPresenter, cwd: string) {
    this.#commands = commands;
    this.#report = report;
    this.#status = status;
    this.#cwd = cwd;
  }

  /** @returns the commands this handler answers */
  public names(): string[] {
    return ['check-graph', 'compile-graph', 'record', 'check-run', 'status'];
  }

  /**
   * @param command - one of {@link WorkflowCliHandler.names}
   * @param args - the arguments after the command
   * @returns what to print and the exit code
   */
  public async run(command: string, args: readonly string[]): Promise<CommandOutput> {
    if (command === 'check-graph') return this.#checkGraph();
    if (command === 'compile-graph') return this.#compileGraph();
    const { values, positionals } = parseArgs({ args: [...args], allowPositionals: true, options: WorkflowCliHandler.#options });
    const project = values.project ?? this.#cwd;
    if (command === 'record') return this.#record(project, positionals[0] ?? '', values);
    if (command === 'check-run') return this.#checkRun(project, positionals[0] ?? '');
    return this.#runStatus(project, positionals[0]);
  }

  static readonly #options = {
    project: { type: 'string' },
    node: { type: 'string' },
    result: { type: 'string' },
    task: { type: 'string' },
    feature: { type: 'string' },
    evidence: { type: 'string' },
    role: { type: 'string' },
  } as const;

  async #checkGraph(): Promise<CommandOutput> {
    const checked = await this.#commands.checkGraph.run();
    const size = checked.graph?.size;
    const header = size === undefined ? 'workflow-graph check-graph: workflow.graph.yaml' : `workflow-graph check-graph: ${checked.graph?.name ?? ''} ${checked.graph?.version ?? ''} (${size.nodes} nodes, ${size.edges} edges, ${size.paths} paths)`;
    return this.#report.render(header, checked.findings);
  }

  async #compileGraph(): Promise<CommandOutput> {
    const findings = await this.#commands.compileGraph.run();
    if (findings.length > 0) return this.#report.render('workflow-graph compile-graph: nothing written', findings);
    return { code: 0, out: 'workflow-graph compile-graph: wrote workflow.graph.json and the conventions.md tables' };
  }

  async #record(project: string, run: string, v: Readonly<Record<string, string | undefined>>): Promise<CommandOutput> {
    if (v['node'] === undefined || v['result'] === undefined) return { code: 2, out: 'usage: record <run> --node <id> --result <result> [--task T…] [--feature <folder>] [--evidence a,b] [--role <role>] [--project <dir>]' };
    const optional = { task: v['task'], feature: v['feature'], role: v['role'], evidence: v['evidence']?.split(',').map((p) => p.trim()) };
    const present = Object.fromEntries(Object.entries(optional).filter(([, x]) => x !== undefined));
    const recorded = await this.#commands.recordStep.run({ project, run, node: v['node'], result: v['result'], ...present });
    if (recorded.ok) return { code: 0, out: `recorded ${recorded.value}` };
    return { code: 1, out: `  ${recorded.error.code}  ${run}: ${recorded.error.message}\nFAIL (1)` };
  }

  async #checkRun(project: string, run: string): Promise<CommandOutput> {
    const checked = await this.#commands.checkRun.run(project, run);
    if (!checked.ok) return { code: 1, out: `  WG-15  ${run}: ${checked.error}\nFAIL (1)` };
    return this.#report.render(`workflow-graph check-run: ${run}`, checked.value);
  }

  async #runStatus(project: string, run: string | undefined): Promise<CommandOutput> {
    const statuses = await this.#commands.reportStatus.run(project, run);
    if (!statuses.ok) return { code: 1, out: statuses.error };
    return { code: 0, out: this.#status.render(statuses.value, project) };
  }
}
