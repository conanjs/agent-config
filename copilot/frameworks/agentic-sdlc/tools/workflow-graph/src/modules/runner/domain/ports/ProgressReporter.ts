/** Tells the person watching what the runner is doing, so a long agent run does not look like a hang. */
export interface ProgressReporter {
  /**
   * Shows one line of progress; may show nothing when nobody is watching.
   *
   * @param line - plain text without a line break, such as `P1: architecture (propose) in claude-code …`
   */
  note(line: string): void;
}
