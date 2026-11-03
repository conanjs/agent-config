// Tier B (PDM-class-modeled-R8): the `ok` and `err` constructors are tiny pure helpers with no role, shared by every module.
/** An expected outcome: a value, or a rule failure the caller must handle (idiom.errors). */
export type Result<T, E> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: E };

/**
 * Returns it wrapped as a success.
 *
 * @param value - the successful outcome
 * @returns it wrapped as a success
 */
export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
/**
 * Returns it wrapped as a failure.
 *
 * @param error - the expected failure
 * @returns it wrapped as a failure
 */
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });
