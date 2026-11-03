import { err, ok, type Result } from '#src/modules/shared/domain/Result.ts';
import type { GuardDecision, HookDialect, SubmittedPrompt, ToolCallRequest } from '#src/modules/coding-agents/domain/ports/HookDialect.ts';
import { HookPayload } from '#src/modules/coding-agents/infrastructure/HookPayload.ts';
import { CodexTaskName } from './CodexTaskName.ts';

// Hook tool names of a spawn: `spawn_agent` (default or multi_agent_v1 namespace, alias `Agent`) or the namespace
// glued to the name with no alias, as Codex 0.164 sends a collaboration spawn: `collaborationspawn_agent`.
const LAUNCH = /^(Agent|[a-z0-9_]*spawn_agent)$/;
const RUN_LINE = /^\s*run:/m;
const WRITE = new Set(['apply_patch', 'Edit', 'Write']);
const PATCH_FILE = /^\*\*\* (?:Add|Update|Delete) File: (.+)$/gm;

/** Codex's hook JSON (`tool_name`, `tool_input`); deny as Claude Code does. A spawn's prompt is `message`; when it is encrypted (no readable `run:` line), the run comes from the `task_name` convention ({@link CodexTaskName}). Verified against Codex 0.164.0-alpha.11 (source and live runs, 2026-11-03). */
export class CodexHookDialect implements HookDialect {
  /** Reads `spawn_agent` launches and `apply_patch` file paths. @param raw - the hook's stdin @returns the neutral tool call */
  public readToolCall(raw: string): Result<ToolCallRequest, string> {
    const p = HookPayload.parse(raw);
    if (!p.ok) return err(p.error);
    const tool = p.value.text('tool_name') ?? '';
    const input = p.value.object('tool_input');
    const cwd = p.value.text('cwd') ?? '.';
    if (LAUNCH.test(tool)) return ok({ kind: 'subagent-launch', prompt: this.#launchPrompt(input), cwd });
    if (WRITE.has(tool)) {
      const fromPatch = [...(input?.text('command') ?? '').matchAll(PATCH_FILE)].map((m) => String(m[1]).trim());
      const direct = input?.text('file_path');
      return ok({ kind: 'file-write', paths: direct === undefined ? fromPatch : [...fromPatch, direct], cwd });
    }
    return ok({ kind: 'other-tool' });
  }

  #launchPrompt(input: HookPayload | undefined): string {
    const message = input?.text('message', 'prompt') ?? '';
    if (RUN_LINE.test(message)) return message;
    return CodexTaskName.read(input?.text('task_name') ?? '')?.toLaunchPrompt() ?? message;
  }

  /** Reads `UserPromptSubmit`: `prompt`, `session_id`, `transcript_path`. @param raw - the hook's stdin @returns the message */
  public readSubmittedPrompt(raw: string): Result<SubmittedPrompt, string> {
    const p = HookPayload.parse(raw);
    if (!p.ok) return err(p.error);
    const log = p.value.text('transcript_path');
    const base = { text: p.value.text('prompt') ?? '', session: p.value.text('session_id') ?? '', cwd: p.value.text('cwd') ?? '.', event: 'UserPromptSubmit' };
    return ok(log === undefined ? base : { ...base, log });
  }

  /** Writes the `hookSpecificOutput` deny object, or nothing. @param decision - the guard's answer @returns stdout */
  public renderDecision(decision: GuardDecision): string {
    if (decision.kind === 'no-decision') return '';
    return JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: decision.reason } });
  }

  /** A recording prompt hook prints nothing. @returns an empty string */
  public renderPromptAcknowledgement(): string {
    return '';
  }
}
