import type { Result } from "#src/modules/shared/domain/Result.ts";

/** What a pre-tool-use hook was asked about, in neutral terms. */
export type ToolCallRequest =
  | { readonly kind: "subagent-launch"; readonly prompt: string; readonly cwd: string }
  | { readonly kind: "file-write"; readonly paths: readonly string[]; readonly cwd: string }
  | { readonly kind: "other-tool" };

/** A message the human submitted, with what identifies its session and session log. */
export type SubmittedPrompt = {
  /** The message exactly as typed. */
  readonly text: string;
  /** The agent's session id. */
  readonly session: string;
  /** Folder the session works in: the project whose ledgers are touched. */
  readonly cwd: string;
  /** Hook event name as the agent calls it, written into the approval's source. */
  readonly event: string;
  /** Path of the session log when the agent gives one; absent otherwise. */
  readonly log?: string;
};

/** The guard's answer, in neutral terms. */
export type GuardDecision =
  { readonly kind: "no-decision" } | { readonly kind: "deny"; readonly reason: string };

/** Translates one coding agent's hook JSON to and from the neutral shapes (WG-29). */
export interface HookDialect {
  /**
   * Returns the tool call, or why the input cannot be read.
   *
   * @param raw - the hook's stdin
   * @returns the tool call, or why the input cannot be read
   */
  readToolCall(raw: string): Result<ToolCallRequest, string>;
  /**
   * Returns the message, or why the input cannot be read.
   *
   * @param raw - the prompt-submit hook's stdin
   * @returns the message, or why the input cannot be read
   */
  readSubmittedPrompt(raw: string): Result<SubmittedPrompt, string>;
  /**
   * Returns the exact stdout this agent expects.
   *
   * @param decision - the guard's answer
   * @returns the exact stdout this agent expects
   */
  renderDecision(decision: GuardDecision): string;
  /**
   * Returns the stdout of a prompt-submit hook that only records.
   *
   * @returns the stdout of a prompt-submit hook that only records
   */
  renderPromptAcknowledgement(): string;
}
