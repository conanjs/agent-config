import { parseArgs } from "node:util";
import type { CommandOutput } from "#src/modules/shared/domain/CommandOutput.ts";
import type { OptionTable } from "#src/modules/shared/domain/OptionTable.ts";
import type { FindingsReport } from "#src/modules/workflow/application/report/FindingsReport.ts";
import { AgentId } from "#src/modules/coding-agents/domain/AgentId.ts";
import type { CodingAgentRegistry } from "#src/modules/coding-agents/application/CodingAgentRegistry.ts";
import type { VerifyApprovals } from "#src/modules/coding-agents/application/verify-approvals/VerifyApprovals.ts";
import type { HookHandler } from "#src/modules/coding-agents/interface/hooks/HookHandler.ts";

/** The command line of the coding-agents module: `hook guard|approve --agent <id>` (stdin in, the agent's format out) and `verify-approvals <run>`. */
export class AgentCliHandler {
  /** The flags each command parses; `workflow-graph interfaces` compares them with the usage spec (IF-3). */
  public static readonly options: ReadonlyMap<string, OptionTable> = new Map<string, OptionTable>([
    ["hook guard", { agent: { type: "string" } }],
    ["hook approve", { agent: { type: "string" } }],
    ["verify-approvals", { project: { type: "string" } }],
  ]);

  readonly #hooks: HookHandler;
  readonly #verify: VerifyApprovals;
  readonly #registry: CodingAgentRegistry;
  readonly #report: FindingsReport;
  readonly #cwd: string;

  /**
   * Keeps the given collaborators for every later call; nothing runs at construction.
   *
   * @param hooks - answers hook calls
   * @param verify - checks approvals against session logs
   * @param registry - the registered agents, for usage messages
   * @param report - prints findings
   * @param cwd - the default project folder
   */
  public constructor(
    hooks: HookHandler,
    verify: VerifyApprovals,
    registry: CodingAgentRegistry,
    report: FindingsReport,
    cwd: string,
  ) {
    this.#hooks = hooks;
    this.#verify = verify;
    this.#registry = registry;
    this.#report = report;
    this.#cwd = cwd;
  }

  /**
   * Returns the commands this handler answers.
   *
   * @returns the commands this handler answers
   */
  public names(): string[] {
    return ["hook", "verify-approvals"];
  }

  /**
   * Returns what to print and the exit code (always 0 for hooks).
   *
   * @param command - `hook` or `verify-approvals`
   * @param args - the arguments after the command
   * @param stdin - the hook's input
   * @returns what to print and the exit code (always 0 for hooks)
   */
  public async run(
    command: string,
    args: readonly string[],
    stdin: () => Promise<string>,
  ): Promise<CommandOutput> {
    if (command === "verify-approvals") return this.#verifyRun(args);
    const [kind = "", ...after] = args;
    const options = AgentCliHandler.options.get(`hook ${kind}`) ?? {};
    const { values } = parseArgs({ args: after, options }) as {
      values: Record<string, string | undefined>;
    };
    const agent = AgentId.parse(values["agent"] ?? "");
    if ((kind !== "guard" && kind !== "approve") || !agent.ok) {
      return {
        code: 2,
        out: `usage: hook guard|approve --agent ${this.#registry.ids().join("|")}`,
      };
    }
    const raw = await stdin();
    return {
      code: 0,
      out:
        kind === "guard"
          ? await this.#hooks.guard(agent.value, raw)
          : await this.#hooks.approve(agent.value, raw),
    };
  }

  async #verifyRun(args: readonly string[]): Promise<CommandOutput> {
    const { values, positionals } = parseArgs({
      args: [...args],
      allowPositionals: true,
      options: AgentCliHandler.options.get("verify-approvals") ?? {},
    }) as { values: Record<string, string | undefined>; positionals: string[] };
    const run = positionals[0] ?? "";
    const project = values["project"] ?? this.#cwd;
    const verified = await this.#verify.run(project, run);
    if (!verified.ok) return { code: 1, out: `  WG-30  ${run}: ${verified.error}\nFAIL (1)` };
    return this.#report.render(`workflow-graph verify-approvals: ${run}`, verified.value);
  }
}
