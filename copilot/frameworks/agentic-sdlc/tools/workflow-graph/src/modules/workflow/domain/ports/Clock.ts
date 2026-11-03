/** The time written into ledger lines. */
export interface Clock {
  /**
   * Returns the current time as an ISO 8601 string.
   *
   * @returns the current time as an ISO 8601 string
   */
  now(): string;
}
