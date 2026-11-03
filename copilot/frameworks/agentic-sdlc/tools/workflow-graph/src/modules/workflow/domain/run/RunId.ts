import { err, ok, type Result } from "#src/modules/shared/domain/Result.ts";

const PATTERN = /^R-\d{3,}$/;

/** A run's name, `R-` and at least three digits (R-007); it is also the ledger file name and LangGraph's thread id. */
export class RunId {
  readonly #value: string;

  private constructor(value: string) {
    this.#value = value;
  }

  /**
   * Accepts `R-` followed by at least three digits, such as `R-007`.
   *
   * @param text - text such as `R-007`
   * @returns the id, or the text that is not a run id
   */
  public static parse(text: string): Result<RunId, string> {
    return PATTERN.test(text) ? ok(new RunId(text)) : err(text);
  }

  /**
   * Returns the id as written, for file names and messages.
   *
   * @returns the id as written, for file names and messages
   */
  public toString(): string {
    return this.#value;
  }
}
