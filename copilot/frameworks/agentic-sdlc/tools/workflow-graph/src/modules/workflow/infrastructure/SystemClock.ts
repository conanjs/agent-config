import type { Clock } from '#src/modules/workflow/domain/ports/Clock.ts';

/** The clock for ledger lines: a fixed time when one is configured (tests), otherwise the system time. */
export class SystemClock implements Clock {
  readonly #fixed: string | undefined;

  /** @param fixed - an ISO time to always return, or undefined for the system time */
  public constructor(fixed: string | undefined) {
    this.#fixed = fixed;
  }

  /** @returns the configured time, or now */
  public now(): string {
    return this.#fixed ?? new Date().toISOString();
  }
}
