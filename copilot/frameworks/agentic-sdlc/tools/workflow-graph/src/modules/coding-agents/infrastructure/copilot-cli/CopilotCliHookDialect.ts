import { join } from 'node:path';
import { err, ok, type Result } from '#src/modules/shared/domain/Result.ts';
import type { GuardDecision, HookDialect, SubmittedPrompt, ToolCallRequest } from '#src/modules/coding-agents/domain/ports/HookDialect.ts';
import { HookPayload } from '#src/modules/coding-agents/infrastructure/HookPayload.ts';

const WRITE = /^(edit|create|write|str_replace_editor|Edit|Write)$/;

/** Copilot CLI's hook JSON, camelCase (`toolName`, `toolArgs`) or the PascalCase form (`tool_name`, `tool_input`); the subagent tool is `task` (tested 1.0.105). */
export class CopilotCliHookDialect implements HookDialect {
  readonly #home: string;

  /** @param home - Copilot's folder (`COPILOT_HOME` or `~/.copilot`), where session logs live */
  public constructor(home: string) {
    this.#home = home;
  }

  /** Reads `task` launches and edit-tool paths. @param raw - the hook's stdin @returns the neutral tool call */
  public readToolCall(raw: string): Result<ToolCallRequest, string> {
    const p = HookPayload.parse(raw);
    if (!p.ok) return err(p.error);
    const tool = p.value.text('toolName', 'tool_name') ?? '';
    const args = p.value.object('toolArgs', 'tool_input');
    const cwd = p.value.text('cwd') ?? '.';
    if (tool === 'task' || tool === 'Agent') return ok({ kind: 'subagent-launch', prompt: args?.text('prompt') ?? '', cwd });
    if (WRITE.test(tool)) return ok({ kind: 'file-write', paths: [args?.text('path', 'file_path', 'filePath') ?? ''], cwd });
    return ok({ kind: 'other-tool' });
  }

  /** Reads `userPromptSubmitted` (`prompt`, `sessionId`); the log is `<home>/session-state/<id>/events.jsonl`. @param raw - the hook's stdin @returns the message */
  public readSubmittedPrompt(raw: string): Result<SubmittedPrompt, string> {
    const p = HookPayload.parse(raw);
    if (!p.ok) return err(p.error);
    const session = p.value.text('sessionId', 'session_id') ?? '';
    return ok({ text: p.value.text('prompt') ?? '', session, cwd: p.value.text('cwd') ?? '.', event: 'userPromptSubmitted', log: join(this.#home, 'session-state', session, 'events.jsonl') });
  }

  /** Writes `{permissionDecision, permissionDecisionReason}`, or `{}`. @param decision - the guard's answer @returns stdout */
  public renderDecision(decision: GuardDecision): string {
    return decision.kind === 'no-decision' ? '{}' : JSON.stringify({ permissionDecision: 'deny', permissionDecisionReason: decision.reason });
  }

  /** Config-file prompt hooks have their output dropped; `{}` is the documented empty answer. @returns `{}` */
  public renderPromptAcknowledgement(): string {
    return '{}';
  }
}
