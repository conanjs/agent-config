import type { CommandOutput } from '#src/modules/shared/domain/CommandOutput.ts';
import type { FindingsReport } from '#src/modules/workflow/application/report/FindingsReport.ts';
import { AgentId } from '#src/modules/coding-agents/domain/AgentId.ts';
import type { CodingAgentRegistry } from '#src/modules/coding-agents/application/CodingAgentRegistry.ts';
import type { VerifyApprovals } from '#src/modules/coding-agents/application/verify-approvals/VerifyApprovals.ts';
import type { HookHandler } from '#src/modules/coding-agents/interface/hooks/HookHandler.ts';

/** The command line of the coding-agents module: `hook guard|approve --agent <id>` (stdin in, the agent's format out) and `verify-approvals <run>`. */
export class AgentCliHandler {
  readonly #hooks: HookHandler;
  readonly #verify: VerifyApprovals;
  readonly #registry: CodingAgentRegistry;
  readonly #report: FindingsReport;
  readonly #cwd: string;

  /**
   * @param hooks - answers hook calls
   * @param verify - checks approvals against session logs
   * @param registry - the registered agents, for usage messages
   * @param report - prints findings
   * @param cwd - the default project folder
   */
  public constructor(hooks: HookHandler, verify: VerifyApprovals, registry: CodingAgentRegistry, report: FindingsReport, cwd: string) {
    this.#hooks = hooks;
    this.#verify = verify;
    this.#registry = registry;
    this.#report = report;
    this.#cwd = cwd;
  }

  /** @returns the commands this handler answers */
  public names(): string[] {
    return ['hook', 'verify-approvals'];
  }

  /**
   * @param command - `hook` or `verify-approvals`
   * @param args - the arguments after the command
   * @param stdin - the hook's input
   * @returns what to print and the exit code (always 0 for hooks)
   */
  public async run(command: string, args: readonly string[], stdin: () => Promise<string>): Promise<CommandOutput> {
    if (command === 'verify-approvals') return this.#verifyRun(args);
    const kind = args[0];
    const agentText = args[args.indexOf('--agent') + 1] ?? '';
    const agent = AgentId.parse(args.includes('--agent') ? agentText : '');
    if ((kind !== 'guard' && kind !== 'approve') || !agent.ok) {
      return { code: 2, out: `usage: hook guard|approve --agent ${this.#registry.ids().join('|')}` };
    }
    const raw = await stdin();
    return { code: 0, out: kind === 'guard' ? await this.#hooks.guard(agent.value, raw) : await this.#hooks.approve(agent.value, raw) };
  }

  async #verifyRun(args: readonly string[]): Promise<CommandOutput> {
    const run = args.find((a) => !a.startsWith('--')) ?? '';
    const project = args.includes('--project') ? (args[args.indexOf('--project') + 1] ?? this.#cwd) : this.#cwd;
    const verified = await this.#verify.run(project, run);
    if (!verified.ok) return { code: 1, out: `  WG-30  ${run}: ${verified.error}\nFAIL (1)` };
    return this.#report.render(`workflow-graph verify-approvals: ${run}`, verified.value);
  }
}
