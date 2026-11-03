import type { Result } from '#src/modules/shared/domain/Result.ts';
import type { SessionLog, SessionRef } from '#src/modules/coding-agents/domain/ports/SessionLog.ts';
import type { JsonlLog } from '#src/modules/coding-agents/infrastructure/JsonlLog.ts';

/** A Copilot session log (`session-state/<id>/events.jsonl`): user messages are `type: "user.message"` events with `data.content`. */
export class CopilotCliSessionLog implements SessionLog {
  readonly #log: JsonlLog;

  /** @param log - the JSON Lines reader */
  public constructor(log: JsonlLog) {
    this.#log = log;
  }

  /** Searches the session's events. @param ref - session and log path @param text - the quote @returns whether it was typed */
  public containsUserMessage(ref: SessionRef, text: string): Promise<Result<boolean, string>> {
    return this.#log.contains(ref.log, text, (line) => {
      const content = (line['data'] as { content?: unknown } | undefined)?.content;
      return line['type'] === 'user.message' && typeof content === 'string' ? [content] : [];
    });
  }
}
