import { err, ok, type Result } from "#src/modules/shared/domain/Result.ts";
import type {
  GuardDecision,
  HookDialect,
  SubmittedPrompt,
  ToolCallRequest,
} from "#src/modules/coding-agents/domain/ports/HookDialect.ts";
import { HookPayload } from "#src/modules/coding-agents/infrastructure/HookPayload.ts";

const LAUNCH = new Set(["Agent", "Task"]);
const WRITE = new Set(["Edit", "Write", "MultiEdit", "NotebookEdit"]);

/** Claude Code's hook JSON: `PreToolUse` with `tool_name` and `tool_input`; a deny is `hookSpecificOutput.permissionDecision` (tested 2.1.129). */
export class ClaudeCodeHookDialect implements HookDialect {
  /**
   * {@link HookDialect.readToolCall}: reads `tool_name: Agent` launches and edit-tool paths.
   */
  public readToolCall(raw: string): Result<ToolCallRequest, string> {
    const p = HookPayload.parse(raw);
    if (!p.ok) return err(p.error);
    const tool = p.value.text("tool_name") ?? "";
    const input = p.value.object("tool_input");
    const cwd = p.value.text("cwd") ?? ".";
    if (LAUNCH.has(tool))
      return ok({ kind: "subagent-launch", prompt: input?.text("prompt") ?? "", cwd });
    if (WRITE.has(tool))
      return ok({
        kind: "file-write",
        paths: [input?.text("file_path", "notebook_path") ?? ""],
        cwd,
      });
    return ok({ kind: "other-tool" });
  }

  /**
   * {@link HookDialect.readSubmittedPrompt}: reads `UserPromptSubmit`: `prompt`, `session_id`, `transcript_path`.
   */
  public readSubmittedPrompt(raw: string): Result<SubmittedPrompt, string> {
    const p = HookPayload.parse(raw);
    if (!p.ok) return err(p.error);
    const log = p.value.text("transcript_path");
    const base = {
      text: p.value.text("prompt") ?? "",
      session: p.value.text("session_id") ?? "",
      cwd: p.value.text("cwd") ?? ".",
      event: "UserPromptSubmit",
    };
    return ok(log === undefined ? base : { ...base, log });
  }

  /**
   * {@link HookDialect.renderDecision}: writes the `PreToolUse` deny object, or nothing.
   */
  public renderDecision(decision: GuardDecision): string {
    if (decision.kind === "no-decision") return "";
    return JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: decision.reason,
      },
    });
  }

  /**
   * {@link HookDialect.renderPromptAcknowledgement}: a recording prompt hook prints nothing.
   */
  public renderPromptAcknowledgement(): string {
    return "";
  }
}
