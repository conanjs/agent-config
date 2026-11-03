import { err, ok, type Result } from "#src/modules/shared/domain/Result.ts";

const KEY = /^(?:```ya?ml\s*)?(run|phase|role|mode|task):[ \t]*(.*?)\s*$/;

/** The keys of a launch prompt (`launch-prompt/v1`) the guard needs, read from the prompt's top-level lines. */
export class LaunchRequest {
  readonly #run: string;
  readonly #phase: string;
  readonly #mode: string;
  readonly #role: string;
  readonly #task: string | undefined;

  private constructor(fields: {
    run: string;
    phase: string;
    mode: string;
    role: string;
    task: string | undefined;
  }) {
    this.#run = fields.run;
    this.#phase = fields.phase;
    this.#mode = fields.mode;
    this.#role = fields.role;
    this.#task = fields.task;
  }

  /**
   * Finds run, phase, role, mode and task among the prompt's top-level `key: value` lines, the first occurrence of each.
   *
   * @param text - the prompt the subagent tool was given
   * @returns the request; `none` when the prompt names no run; or what is malformed (WG-26)
   */
  public static fromPrompt(text: string): Result<LaunchRequest | "none", string> {
    const keys = new Map<string, string>();
    for (const line of text.split("\n")) {
      const m = KEY.exec(line);
      if (m && !keys.has(String(m[1])))
        keys.set(String(m[1]), String(m[2]).replace(/^["']|["']$/g, ""));
    }
    const run = keys.get("run");
    if (run === undefined || run === "") return ok("none");
    const phase = keys.get("phase") ?? "";
    if (!/^P\d+$/.test(phase)) return err(`the launch prompt names run ${run} but no phase P0…P7`);
    const task = /\bT\d{3,}\b/.exec(keys.get("task") ?? "")?.[0];
    return ok(
      new LaunchRequest({
        run,
        phase,
        mode: keys.get("mode") ?? "",
        role: keys.get("role") ?? "",
        task,
      }),
    );
  }

  /**
   * Returns the run id the launch belongs to.
   *
   * @returns the run id the launch belongs to
   */
  public get run(): string {
    return this.#run;
  }

  /**
   * Returns the phase the launch works in, such as `P4`.
   *
   * @returns the phase the launch works in, such as `P4`
   */
  public get phase(): string {
    return this.#phase;
  }

  /**
   * Returns the launch mode (`propose`, `decide`, `execute`, `review`).
   *
   * @returns the launch mode (`propose`, `decide`, `execute`, `review`)
   */
  public get mode(): string {
    return this.#mode;
  }

  /**
   * Returns the role launched, such as `architecture`.
   *
   * @returns the role launched, such as `architecture`
   */
  public get role(): string {
    return this.#role;
  }

  /**
   * Returns the task id from the task line, such as `T004`, when the launch names one.
   *
   * @returns the task id from the task line, such as `T004`, when the launch names one
   */
  public get task(): string | undefined {
    return this.#task;
  }
}
