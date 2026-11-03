import { existsSync } from "node:fs";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { err, ok, type Result } from "#src/modules/shared/domain/Result.ts";
import type {
  HeadlessLaunch,
  HeadlessLauncher,
  HeadlessResult,
} from "#src/modules/coding-agents/domain/ports/HeadlessLauncher.ts";
import type { CommandRunner } from "#src/modules/shared/infrastructure/CommandRunner.ts";

/** `codex exec`: no `--agent` flag, so the prompt names the role file; `workspace-write` sandbox only in execute mode, else read-only (verified 0.164.0-alpha.11.1). */
export class CodexHeadlessLauncher implements HeadlessLauncher {
  readonly #runner: CommandRunner;
  readonly #program: string;
  readonly #agentHome: string;

  /**
   * Keeps the process runner, the codex executable and the framework home that role-file paths are built from.
   *
   * @param runner - starts the process
   * @param program - the `codex` executable
   * @param agentHome - the installed framework home (`~/.copilot`), where role files live
   */
  public constructor(runner: CommandRunner, program: string, agentHome: string) {
    this.#runner = runner;
    this.#program = program;
    this.#agentHome = agentHome;
  }

  /**
   * {@link HeadlessLauncher.commandFor}: builds the argument list; the reply goes to a file given at launch time.
   */
  public commandFor(launch: HeadlessLaunch): readonly string[] {
    return this.#command(launch, "<reply file>");
  }

  /**
   * {@link HeadlessLauncher.launch}: runs Codex and reads its last message from `-o`.
   */
  public async launch(launch: HeadlessLaunch): Promise<Result<HeadlessResult, string>> {
    const replyFile = join(await mkdtemp(join(tmpdir(), "wg-codex-")), "reply.txt");
    const [program = "", ...args] = this.#command(launch, replyFile);
    const out = await this.#runner.run(program, args, launch.cwd, launch.timeoutMs);
    if (!out.ok) return out;
    return existsSync(replyFile)
      ? ok({ reply: await readFile(replyFile, "utf8") })
      : err("codex wrote no last message");
  }

  #command(launch: HeadlessLaunch, replyFile: string): readonly string[] {
    const roleFile = join(
      this.#agentHome,
      "frameworks",
      "agentic-sdlc",
      "agents",
      `${launch.role}.md`,
    );
    const prompt = `Read ${roleFile} and follow it, together with ${join(this.#agentHome, "frameworks", "agentic-sdlc", "conventions.md")}.\n\n${launch.prompt}`;
    const sandbox = launch.mode === "execute" ? "workspace-write" : "read-only";
    return [
      this.#program,
      "exec",
      "--json",
      "--skip-git-repo-check",
      "--sandbox",
      sandbox,
      "-C",
      launch.cwd,
      "-o",
      replyFile,
      prompt,
    ];
  }
}
