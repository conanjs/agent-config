import { err, ok, type Result } from "#src/modules/shared/domain/Result.ts";
import type {
  HeadlessLaunch,
  HeadlessLauncher,
  HeadlessResult,
} from "#src/modules/coding-agents/domain/ports/HeadlessLauncher.ts";
import type { CommandRunner } from "#src/modules/shared/infrastructure/CommandRunner.ts";

/** `claude -p --agent sdlc-<role>`: edits only in execute mode (`acceptEdits` and an allow-list), a spend cap per run (verified 2.1.129). */
export class ClaudeCodeHeadlessLauncher implements HeadlessLauncher {
  readonly #runner: CommandRunner;
  readonly #program: string;

  /**
   * Keeps the given collaborators for every later call; nothing runs at construction.
   *
   * @param runner - starts the process
   * @param program - the `claude` executable
   */
  public constructor(runner: CommandRunner, program: string) {
    this.#runner = runner;
    this.#program = program;
  }

  /**
   * {@link HeadlessLauncher.commandFor}: builds the argument list with the mode's limits.
   */
  public commandFor(launch: HeadlessLaunch): readonly string[] {
    const tools =
      launch.mode === "execute"
        ? ["--permission-mode", "acceptEdits", "--allowedTools", "Read Write Edit Glob Grep Bash"]
        : ["--allowedTools", "Read Glob Grep"];
    return [
      this.#program,
      "-p",
      launch.prompt,
      "--agent",
      `sdlc-${launch.role}`,
      "--output-format",
      "json",
      "--max-budget-usd",
      String(launch.maxUsd),
      ...tools,
    ];
  }

  /**
   * {@link HeadlessLauncher.launch}: runs Claude Code and reads `result` and `total_cost_usd` from its JSON.
   */
  public async launch(launch: HeadlessLaunch): Promise<Result<HeadlessResult, string>> {
    const [program = "", ...args] = this.commandFor(launch);
    const out = await this.#runner.run(program, args, launch.cwd, launch.timeoutMs);
    if (!out.ok) return out;
    try {
      const data = JSON.parse(out.value) as { result?: unknown; total_cost_usd?: unknown };
      const reply = typeof data.result === "string" ? data.result : "";
      return ok(
        typeof data.total_cost_usd === "number"
          ? { reply, costUsd: data.total_cost_usd }
          : { reply },
      );
    } catch {
      return err("claude did not print JSON");
    }
  }
}
