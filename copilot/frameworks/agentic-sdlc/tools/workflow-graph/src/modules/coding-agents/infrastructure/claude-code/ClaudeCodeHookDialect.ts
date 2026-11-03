import { err, ok, type Result } from '#src/modules/shared/domain/Result.ts';
import type { GuardDecision, HookDialect, SubmittedPrompt, ToolCallRequest } from '#src/modules/coding-agents/domain/ports/HookDialect.ts';
import { HookPayload } from '#src/modules/coding-agents/infrastructure/HookPayload.ts';

const LAUNCH = new Set(['Agent', 'Task']);
const WRITE = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit']);

/** Claude Code's hook JSON: `PreToolUse` with `tool_name` and `tool_input`; a deny is `hookSpecificOutput.permissionDecision` (tested 2.1.129). */
export class ClaudeCodeHookDialect implements HookDialect {
  /** Reads `tool_name: Agent` launches and edit-tool paths. @param raw - the hook's stdin @returns the neutral tool call */
  public readToolCall(raw: string): Result<ToolCallRequest, string> {
    const p = HookPayload.parse(raw);
    if (!p.ok) return err(p.error);
    const tool = p.value.text('tool_name') ?? '';
    const input = p.value.object('tool_input');
    const cwd = p.value.text('cwd') ?? '.';
    if (LAUNCH.has(tool)) return ok({ kind: 'subagent-launch', prompt: input?.text('prompt') ?? '', cwd });
    if (WRITE.has(tool)) return ok({ kind: 'file-write', paths: [input?.text('file_path', 'notebook_path') ?? ''], cwd });
    return ok({ kind: 'other-tool' });
  }

  /** Reads `UserPromptSubmit`: `prompt`, `session_id`, `transcript_path`. @param raw - the hook's stdin @returns the message */
  public readSubmittedPrompt(raw: string): Result<SubmittedPrompt, string> {
    const p = HookPayload.parse(raw);
    if (!p.ok) return err(p.error);
    const log = p.value.text('transcript_path');
    const base = { text: p.value.text('prompt') ?? '', session: p.value.text('session_id') ?? '', cwd: p.value.text('cwd') ?? '.', event: 'UserPromptSubmit' };
    return ok(log === undefined ? base : { ...base, log });
  }

  /** Writes the `PreToolUse` deny object, or nothing. @param decision - the guard's answer @returns stdout */
  public renderDecision(decision: GuardDecision): string {
    if (decision.kind === 'no-decision') return '';
    return JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: decision.reason } });
  }

  /** A recording prompt hook prints nothing. @returns an empty string */
  public renderPromptAcknowledgement(): string {
    return '';
  }
}
