import { err, ok, type Result } from "#src/modules/shared/domain/Result.ts";

const KNOWN: ReadonlySet<string> = new Set(["claude-code", "copilot-cli", "codex"]);

/** Which coding agent a hook call comes from. The only place an agent's name is turned into a choice is the registry lookup. */
export class AgentId {
  readonly #value: string;

  private constructor(value: string) {
    this.#value = value;
  }

  /**
   * Returns the id, or the text that names no supported agent.
   *
   * @param text - `claude-code`, `copilot-cli` or `codex`
   * @returns the id, or the text that names no supported agent
   */
  public static parse(text: string): Result<AgentId, string> {
    return KNOWN.has(text) ? ok(new AgentId(text)) : err(text);
  }

  /**
   * Returns the id as written, the registry key and the prefix of an approval's `source`.
   *
   * @returns the id as written, the registry key and the prefix of an approval's `source`
   */
  public toString(): string {
    return this.#value;
  }
}
