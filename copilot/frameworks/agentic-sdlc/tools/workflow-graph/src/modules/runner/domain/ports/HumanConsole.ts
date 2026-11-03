import type { Result } from "#src/modules/shared/domain/Result.ts";

/** Asks the person at the controlling terminal; an agent's shell tool has none (specs/020 D27). */
export interface HumanConsole {
  /**
   * Returns what the person typed, or why there is no terminal.
   *
   * @param question - shown on the terminal
   * @returns what the person typed, or why there is no terminal
   */
  ask(question: string): Promise<Result<string, string>>;
}
