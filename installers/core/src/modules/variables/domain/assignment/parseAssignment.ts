// `set NAME=value`: split the one argument at the first `=`. Nothing is trimmed, so a value keeps its spaces; whether the name and the
// value are acceptable is for the steps after this one.
import { refuse, succeed, type Result } from '#shared/domain/result/Result.ts';

/** The two halves of a `set` argument, as typed. */
export interface Assignment {
  /** The text before the first `=`. */
  readonly name: string;
  /** The text after the first `=`, possibly empty. */
  readonly value: string;
}

/** Why an argument is not a `NAME=value` pair; the command answers it with the usage line, not with the text. */
export interface AssignmentViolation {
  /** `no-equals-sign` for `NAME`; `no-name` for `=value`. */
  readonly kind: 'no-equals-sign' | 'no-name';
}

/**
 * Splits a `set` argument at its first equals sign.
 *
 * @param argument - the text after `set`, for example `LANGUAGE=English` or `ROOT=/a=b`
 * @returns the name and value as typed (the value may be empty and may hold more `=`), or why the argument is not a pair
 */
export function parseAssignment(argument: string): Result<Assignment, AssignmentViolation> {
  const at = argument.indexOf('=');
  if (at === -1) return refuse({ kind: 'no-equals-sign' });
  if (at === 0) return refuse({ kind: 'no-name' });
  return succeed({ name: argument.slice(0, at), value: argument.slice(at + 1) });
}
