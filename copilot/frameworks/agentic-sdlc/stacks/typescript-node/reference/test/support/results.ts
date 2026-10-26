import type { Result } from "@/domain/Result.js";

/**
 * Returns the value of a successful result and fails the test otherwise.
 *
 * @param result - Result expected to be `ok`.
 * @returns The wrapped value.
 * @throws `Error` naming the error code when `result` is a failure.
 */
export function valueOf<T, E extends string>(result: Result<T, E>): T {
  if (!result.ok) throw new Error(`expected ok, got ${result.error}`);
  return result.value;
}
