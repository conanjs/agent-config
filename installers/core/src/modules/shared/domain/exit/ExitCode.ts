/**
 * The process exit codes of the installer and what each one promises (installer-cli.md, "Exit codes").
 *
 * `done` is also "no changes" and a `doctor` run with warnings only; `needsInput` means nothing was changed and V must
 * supply a home confirmation, components, variables or an approval; `failed` means a check failed and the previous state
 * stays linked; `usageError` means an unknown command or flag.
 */
export const ExitCode = {
  done: 0,
  needsInput: 10,
  failed: 1,
  usageError: 2,
} as const;

/** One of the four exit code values of {@link ExitCode}. */
export type ExitCode = (typeof ExitCode)[keyof typeof ExitCode];
