const CONVENTION = /^r(\d{3,})_p(\d+)_([a-z][a-z0-9_]*?)(?:_t(\d{3,})_(execute|review))?$/;

/**
 * The agentic-sdlc naming convention for Codex spawns: `r<run>_p<phase>_<role>`, plus `_t<task>_<mode>` in P6
 * (`r004_p4_architecture`, `r004_p6_engineering_t001_execute`). Codex 0.164 sends a collaboration spawn's message
 * encrypted, but `task_name` (lowercase letters, digits, underscores) in plain text, so the guard reads the run here.
 */
export class CodexTaskName {
  readonly #lines: string;

  private constructor(lines: string) {
    this.#lines = lines;
  }

  /**
   * @param taskName - the spawn's `task_name`
   * @returns the convention as launch-prompt lines, or undefined when the name follows no run convention
   */
  public static read(taskName: string): CodexTaskName | undefined {
    const m = CONVENTION.exec(taskName);
    if (m === null) return undefined;
    const lines = [`run: R-${String(m[1])}`, `phase: P${String(m[2])}`, `role: ${String(m[3]).replace(/_/g, '-')}`];
    if (m[4] !== undefined) lines.push(`task: T${m[4]}`, `mode: ${String(m[5])}`);
    return new CodexTaskName(lines.join('\n'));
  }

  /** @returns the keys as `launch-prompt/v1` lines the guard reads */
  public toLaunchPrompt(): string {
    return this.#lines;
  }
}
