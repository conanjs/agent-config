import type { Result } from '#src/modules/shared/domain/Result.ts';

/** Where an approval says it came from: the session and, when known, its log file. */
export type SessionRef = { readonly session: string; readonly log?: string };

/** One agent's session log, read to confirm the human really typed an approval (WG-30). */
export interface SessionLog {
  /**
   * @param ref - the session and its log file
   * @param text - the quote to find
   * @returns whether a user message of that session contains the text, or why the log cannot be read
   */
  containsUserMessage(ref: SessionRef, text: string): Promise<Result<boolean, string>>;
}
