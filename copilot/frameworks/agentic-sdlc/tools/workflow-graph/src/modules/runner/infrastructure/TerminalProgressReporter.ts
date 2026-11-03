import type { ProgressReporter } from "#src/modules/runner/domain/ports/ProgressReporter.ts";

/** Progress lines on standard error, only when it is a terminal; scripts and tests see nothing. */
export class TerminalProgressReporter implements ProgressReporter {
  /**
   * {@link ProgressReporter.note}: writes to standard error with the local time, and nothing when standard error is not a terminal.
   */
  public note(line: string): void {
    if (process.stderr.isTTY) process.stderr.write(`${new Date().toLocaleTimeString()}  ${line}\n`);
  }
}
