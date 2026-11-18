// The one file of the installer that writes to standard output and standard error (M-07, M-11; the lint rule of installers/eslint.config.mjs
// names it). Every line it prints was redacted and escaped when it was made, by the message catalogue and by `buildReport`, so this file
// only chooses the stream and the format: text mode prints the lines, `--json` prints the one report document and nothing else (AC-4.3).
import type { CommandOutput } from '#commands/application/install/InstallTypes.ts';

/** The two streams of the run, so tests print into lists and `src/CompositionRoot.ts` gives the process streams. */
export interface OutputStreams {
  /**
   * Writes text to standard output.
   *
   * @param text - the text with its own line breaks
   */
  out(text: string): void;

  /**
   * Writes text to standard error.
   *
   * @param text - the text with its own line breaks
   */
  err(text: string): void;
}

/** How a report is shown: the lines of text mode, or one JSON document. */
export type OutputMode = 'text' | 'json';

/**
 * Connects the presenter to the real standard output and standard error of the process.
 *
 * @returns streams that write to the process's standard output and standard error
 */
export function createProcessStreams(): OutputStreams {
  return {
    out: (text) => {
      process.stdout.write(text);
    },
    err: (text) => {
      process.stderr.write(text);
    },
  };
}

/**
 * Prints the result of a command: the lines on standard output, or the report as one JSON document on standard output.
 *
 * A usage error is the one result that goes to standard error, as one line, with nothing on standard output (MG-12); a JSON report
 * never goes to standard error (AC-4.3).
 *
 * @param output - the result of a command
 * @param mode - `text` for the lines, `json` for the report
 * @param streams - where to print
 */
export function present(output: CommandOutput, mode: OutputMode, streams: OutputStreams): void {
  if (output.report.status === 'usage-error') {
    streams.err(`${output.text.join('\n')}\n`);
    return;
  }
  streams.out(mode === 'json' ? `${JSON.stringify(output.report, null, 2)}\n` : `${output.text.join('\n')}\n`);
}
