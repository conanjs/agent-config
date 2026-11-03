/** The time written into ledger lines. */
export interface Clock {
  /** @returns the current time as an ISO 8601 string */
  now(): string;
}
