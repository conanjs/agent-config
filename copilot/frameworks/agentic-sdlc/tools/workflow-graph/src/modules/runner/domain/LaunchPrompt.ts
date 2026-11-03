/** What one role launch is about. */
export type LaunchSpec = {
  /** Run id, such as R-007. */
  readonly run: string;
  /** Phase of the launch, P0 to P7. */
  readonly phase: string;
  /** Role id the agent plays. */
  readonly role: string;
  /** propose, decide, execute or review. */
  readonly mode: string;
  /** Feature folder, such as specs/023-cart; state paths are under it. */
  readonly feature: string;
  /** Task id for P6 launches, such as T001. */
  readonly task?: string;
  /** Attempt number for retried execute launches. */
  readonly attempt?: number;
  /** What the run is for, in the human's words. */
  readonly mission?: string;
};

/** A `launch-prompt/v1` text for a headless role: ids and paths only, never file contents (launch-prompt schema). */
export class LaunchPrompt {
  readonly #text: string;

  private constructor(text: string) {
    this.#text = text;
  }

  /**
   * Builds launch-prompt/v1 text with state paths under the feature folder and the mission; never file contents.
   *
   * @param spec - what the launch is about
   * @returns the prompt object; `String(prompt)` gives the text
   */
  public static for(spec: LaunchSpec): LaunchPrompt {
    const lines = [
      "schema: launch-prompt/v1",
      `mode: ${spec.mode}`,
      `role: ${spec.role}`,
      `phase: ${spec.phase}`,
      `run: ${spec.run}`,
      ...(spec.task === undefined
        ? [`task: "${spec.phase} of ${spec.feature}"`]
        : [`task: "${spec.task} (see ${spec.feature}/tasks.md)"`]),
      "state:",
      "  constitution: .specify/memory/constitution.md",
      "  architecture: docs/architecture.md",
      `  spec: ${spec.feature}/spec.md`,
      `  plan: ${spec.feature}/plan.md`,
      `  research: ${spec.feature}/research.md`,
      `  tasks: ${spec.feature}/tasks.md`,
      ...(spec.attempt === undefined ? [] : ["context:", `  attempt: ${spec.attempt}`]),
      "output: schemas/message.schema.md",
      "",
      ...(spec.mission === undefined ? [] : [`Mission: ${spec.mission}`]),
      "Work only in this folder. Reply with one message/v2 block (schemas/message.schema.md).",
    ];
    return new LaunchPrompt(lines.join("\n"));
  }

  /**
   * Gives the text exactly as passed to the headless agent's prompt argument.
   *
   * @returns the prompt text
   */
  public toString(): string {
    return this.#text;
  }
}
