const TYPE = /^\s*type:\s*([a-z-]+)/m;
const REASON = /^\s*reason:\s*([a-z-]+)/m;
const SUMMARY = /^\s*summary:\s*(.+)$/m;

/** A role's `message/v2` reply, read only for what the graph needs: which result it is (specs/020 US1.2). */
export class RoleReply {
  readonly #result: string;
  readonly #summary: string;

  private constructor(result: string, summary: string) {
    this.#result = result;
    this.#summary = summary;
  }

  /**
   * Maps the reply's `type` and `reason` to a graph result. A reply without a `message/v2` block is `blocked`, so the
   * graph takes the `otherwise` edge and the run stops for a person.
   * @param text - everything the agent printed
   * @returns the graph result and the one-line summary read from the text
   */
  public static read(text: string): RoleReply {
    const block = text.slice(Math.max(0, text.indexOf("schema: message/v2")));
    const type = text.includes("schema: message/v2") ? TYPE.exec(block)?.[1] : undefined;
    const summary = SUMMARY.exec(block)?.[1]?.trim() ?? text.trim().split("\n").slice(-1)[0] ?? "";
    return new RoleReply(RoleReply.#resultOf(type, REASON.exec(block)?.[1]), summary);
  }

  static #resultOf(type: string | undefined, reason: string | undefined): string {
    if (type === "artifact" || type === "decision" || type === "proposal") return "done";
    if (type === "review-pass") return "pass";
    if (type === "review-fail")
      return reason === "spec-or-plan-wrong" ? "spec-or-plan-wrong" : "review-fail";
    return "blocked";
  }

  /**
   * Returns `done`, `pass`, `review-fail`, `spec-or-plan-wrong` or `blocked`.
   *
   * @returns `done`, `pass`, `review-fail`, `spec-or-plan-wrong` or `blocked`
   */
  public get result(): string {
    return this.#result;
  }

  /**
   * Returns the reply's one-line summary, for the run's report.
   *
   * @returns the reply's one-line summary, for the run's report
   */
  public get summary(): string {
    return this.#summary;
  }
}
