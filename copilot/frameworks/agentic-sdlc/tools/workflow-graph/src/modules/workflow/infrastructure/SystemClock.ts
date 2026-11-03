import type { Clock } from "#src/modules/workflow/domain/ports/Clock.ts";

/** The clock for ledger lines: a fixed time when one is configured (tests), otherwise the system time. */
export class SystemClock implements Clock {
  readonly #fixed: string | undefined;

  /**
   * Chooses between a fixed time (tests) and the system clock, once at startup.
   *
   * @param fixed - an ISO time to always return, or undefined for the system time
   */
  public constructor(fixed: string | undefined) {
    this.#fixed = fixed;
  }

  /**
   * {@link Clock.now}: the fixed time when one is configured (tests), otherwise the system time in UTC.
   */
  public now(): string {
    return this.#fixed ?? new Date().toISOString();
  }
}
