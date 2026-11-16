/** The clock, so a run reads the time and waits only through a port (CA-7); the scenario layer fixes it. */
export interface Clock {
  /**
   * Gives the current instant of the machine, or of the fixed clock of a scenario.
   *
   * @returns the instant
   */
  now(): Date;

  /**
   * Pauses between two looks at the lock, so a waiting run does not spin.
   *
   * @param milliseconds - how long
   * @returns a promise that resolves after that time (a fixed clock resolves at once)
   */
  sleep(milliseconds: number): Promise<void>;
}
