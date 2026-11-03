import type { Result } from '#src/modules/shared/domain/Result.ts';
import type { SessionLog, SessionRef } from '#src/modules/coding-agents/domain/ports/SessionLog.ts';
import type { JsonlLog } from '#src/modules/coding-agents/infrastructure/JsonlLog.ts';

/** A Claude Code transcript: user messages are `type: "user"` lines whose `message.content` is a string or text blocks. */
export class ClaudeCodeSessionLog implements SessionLog {
  readonly #log: JsonlLog;

  /** @param log - the JSON Lines reader */
  public constructor(log: JsonlLog) {
    this.#log = log;
  }

  /** Searches the transcript named in the approval line. @param ref - session and transcript path @param text - the quote @returns whether it was typed */
  public containsUserMessage(ref: SessionRef, text: string): Promise<Result<boolean, string>> {
    return this.#log.contains(ref.log, text, (line) => {
      if (line['type'] !== 'user' || line['isMeta'] === true) return [];
      const content = (line['message'] as { content?: unknown } | undefined)?.content;
      if (typeof content === 'string') return [content];
      return Array.isArray(content) ? content.flatMap((b: { type?: string; text?: unknown }) => (b.type === 'text' && typeof b.text === 'string' ? [b.text] : [])) : [];
    });
  }
}
