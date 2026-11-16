/** The outcome of a step that can fail in an expected way: a value, or the reason it was refused. */
export type Result<Value, Failure> =
  { readonly ok: true; readonly value: Value } | { readonly ok: false; readonly error: Failure };

/**
 * Wraps a value as the successful outcome of a step.
 *
 * @param value - what the step produced
 * @returns the successful {@link Result}
 */
export function succeed<Value>(value: Value): Result<Value, never> {
  return { ok: true, value };
}

/**
 * Wraps a reason as the refused outcome of a step.
 *
 * @param error - why the step refused its input
 * @returns the failed {@link Result}
 */
export function refuse<Failure>(error: Failure): Result<never, Failure> {
  return { ok: false, error };
}
