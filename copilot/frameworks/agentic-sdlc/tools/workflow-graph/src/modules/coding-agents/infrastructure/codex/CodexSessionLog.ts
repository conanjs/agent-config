import type { Result } from '#src/modules/shared/domain/Result.ts';
import type { SessionLog, SessionRef } from '#src/modules/coding-agents/domain/ports/SessionLog.ts';
import type { JsonlLog } from '#src/modules/coding-agents/infrastructure/JsonlLog.ts';

/** A Codex rollout file: a user message is a `response_item` line whose payload is a `message` with `role: "user"` and `input_text` content (seen in Codex 0.164.0-alpha.11.1, 2026-11-03). */
export class CodexSessionLog implements SessionLog {
  readonly #log: JsonlLog;

  /** @param log - the JSON Lines reader */
  public constructor(log: JsonlLog) {
    this.#log = log;
  }

  /** Searches the rollout named in the approval line. @param ref - session and rollout path @param text - the quote @returns whether it was typed */
  public containsUserMessage(ref: SessionRef, text: string): Promise<Result<boolean, string>> {
    return this.#log.contains(ref.log, text, (line) => {
      const payload = line['payload'] as { type?: unknown; role?: unknown; content?: unknown } | undefined;
      if (line['type'] !== 'response_item' || payload?.type !== 'message' || payload.role !== 'user' || !Array.isArray(payload.content)) return [];
      return payload.content.flatMap((c: { type?: unknown; text?: unknown }) => (c.type === 'input_text' && typeof c.text === 'string' ? [c.text] : []));
    });
  }
}
