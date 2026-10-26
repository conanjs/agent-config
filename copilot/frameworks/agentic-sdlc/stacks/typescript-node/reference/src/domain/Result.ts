/**
 * Outcome of an operation whose failures are expected and named, so the caller must handle each one.
 *
 * @remarks
 * Unexpected failures (I/O, bugs) are thrown as `Error` subclasses instead (TSN-4, TSN-5).
 */
export type Result<T, E extends string> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: E };
