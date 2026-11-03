const PATTERN = /\b(approve|changes)\s+(G\d+)\s+(R-\d{3,})\b/gi;

/** A gate decision the human typed: `approve G2 R-007` or `changes G2 R-007`, with the whole message as the quote (WG-28). */
export class Approval {
  readonly #gate: string;
  readonly #run: string;
  readonly #result: "approved" | "changes-requested";
  readonly #quote: string;

  private constructor(
    gate: string,
    run: string,
    result: "approved" | "changes-requested",
    quote: string,
  ) {
    this.#gate = gate;
    this.#run = run;
    this.#result = result;
    this.#quote = quote;
  }

  /**
   * Finds every gate decision in a typed message.
   * @param text - what the human submitted, exactly
   * @returns one approval per `approve|changes G<n> R-<nnn>` phrase; empty when there is none
   */
  public static allIn(text: string): Approval[] {
    const quote = text.trim().slice(0, 2000);
    return [...text.matchAll(PATTERN)].map(
      (m) =>
        new Approval(
          String(m[2]).toUpperCase(),
          String(m[3]).toUpperCase(),
          String(m[1]).toLowerCase() === "approve" ? "approved" : "changes-requested",
          quote,
        ),
    );
  }

  /**
   * Returns the gate the decision is for, such as `G2`.
   *
   * @returns the gate the decision is for, such as `G2`
   */
  public get gate(): string {
    return this.#gate;
  }

  /**
   * Returns the run the decision is for, such as `R-007`.
   *
   * @returns the run the decision is for, such as `R-007`
   */
  public get run(): string {
    return this.#run;
  }

  /**
   * Returns the gate result the decision records.
   *
   * @returns the gate result the decision records
   */
  public get result(): "approved" | "changes-requested" {
    return this.#result;
  }

  /**
   * Returns the human's message, trimmed to 2,000 characters.
   *
   * @returns the human's message, trimmed to 2,000 characters
   */
  public get quote(): string {
    return this.#quote;
  }
}
