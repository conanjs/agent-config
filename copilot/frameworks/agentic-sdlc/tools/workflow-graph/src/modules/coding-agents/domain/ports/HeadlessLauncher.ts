import type { Result } from "#src/modules/shared/domain/Result.ts";

/** One headless role run: the launch prompt, who and how, where, and its limits. */
export type HeadlessLaunch = {
  /** launch-prompt/v1 text: ids and paths only. */
  readonly prompt: string;
  /** Role id, such as architecture; selects the agent file sdlc-<role>. */
  readonly role: string;
  /** propose, decide, execute or review; only execute may write. */
  readonly mode: string;
  /** Worktree folder the agent works in. */
  readonly cwd: string;
  /** Spend cap for this launch in US dollars, where the agent supports one. */
  readonly maxUsd: number;
  /** Kill the agent after this many milliseconds. */
  readonly timeoutMs: number;
};

/** What a headless run returned: the role's reply text and, when the agent reports it, the cost in US dollars. */
export type HeadlessResult = {
  /** Everything the agent printed as its answer; should hold one message/v2 block. */
  readonly reply: string;
  /** Dollars the agent reported for this run; absent when it reports none. */
  readonly costUsd?: number;
};

/** Starts one coding agent without a chat window, limited by mode: write access only in `execute` (specs/020 plan, worker limits). */
export interface HeadlessLauncher {
  /**
   * Returns the reply, or why the agent could not run.
   *
   * @param launch - the run to start
   * @returns the reply, or why the agent could not run
   */
  launch(launch: HeadlessLaunch): Promise<Result<HeadlessResult, string>>;
  /**
   * Returns the program and arguments it would run, for logs and tests.
   *
   * @param launch - the run to start
   * @returns the program and arguments it would run, for logs and tests
   */
  commandFor(launch: HeadlessLaunch): readonly string[];
}
