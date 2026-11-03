import { ok, type Result } from "#src/modules/shared/domain/Result.ts";
import type {
  HeadlessLaunch,
  HeadlessLauncher,
  HeadlessResult,
} from "#src/modules/coding-agents/domain/ports/HeadlessLauncher.ts";
import type { CommandRunner } from "#src/modules/shared/infrastructure/CommandRunner.ts";

/** `copilot -p --agent sdlc-<role> --silent`: write and shell tools allowed only in execute mode (verified 1.0.105). The folder must be trusted. */
export class CopilotCliHeadlessLauncher implements HeadlessLauncher {
  readonly #runner: CommandRunner;
  readonly #program: string;

  /**
   * Keeps the given collaborators for every later call; nothing runs at construction.
   *
   * @param runner - starts the process
   * @param program - the `copilot` executable
   */
  public constructor(runner: CommandRunner, program: string) {
    this.#runner = runner;
    this.#program = program;
  }

  /**
   * {@link HeadlessLauncher.commandFor}: builds the argument list with the mode's limits.
   */
  public commandFor(launch: HeadlessLaunch): readonly string[] {
    const tools = launch.mode === "execute" ? ["--allow-tool=write", "--allow-tool=shell"] : [];
    return [
      this.#program,
      "-p",
      launch.prompt,
      "--agent",
      `sdlc-${launch.role}`,
      "--no-ask-user",
      "--silent",
      ...tools,
    ];
  }

  /**
   * {@link HeadlessLauncher.launch}: runs Copilot; with `--silent` stdout is the agent's reply.
   */
  public async launch(launch: HeadlessLaunch): Promise<Result<HeadlessResult, string>> {
    const [program = "", ...args] = this.commandFor(launch);
    const out = await this.#runner.run(program, args, launch.cwd, launch.timeoutMs);
    return out.ok ? ok({ reply: out.value }) : out;
  }
}
