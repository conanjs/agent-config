/** What one command prints and the process exit code it ends with. */
export type CommandOutput = {
  /** Process exit code: 0 success, 1 a finding or refusal, 2 bad usage. */
  readonly code: number;
  /** Text to print; empty prints nothing. */
  readonly out: string;
};
