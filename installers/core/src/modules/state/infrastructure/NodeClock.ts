import type { Clock } from '#state/application/ports/Clock.ts';

/** The real clock: the system time, and a timer for `sleep`. */
export const nodeClock: Clock = {
  now: () => new Date(),
  sleep: (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
};
