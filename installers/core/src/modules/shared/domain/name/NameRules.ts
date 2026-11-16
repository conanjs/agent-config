// M-03 names and path fields as the installer reads them. The rules themselves are owned by contracts/lib (value-problems.ts);
// this file only turns their sentences into a Result and brands the accepted text, so a function that needs a checked name
// cannot be handed an unchecked string by mistake.
import { idProblem, relativePathProblem } from '../../../../../../../contracts/lib/value-problems.ts';
import { refuse, succeed, type Result } from '#shared/domain/result/Result.ts';

/** A component, skill, agent, route or hook id that matches the M-03 allow-list. */
export type ComponentName = string & { readonly checkedAs: 'ComponentName' };

/** A path field from a component that is relative, with no `..` segment, drive letter, colon, backslash or NUL (M-03). */
export type RelativePath = string & { readonly checkedAs: 'RelativePath' };

/** Why a name or path field was refused. */
export interface NameViolation {
  /** Which kind of field was refused. */
  readonly kind: 'invalid-name' | 'invalid-path';
  /** The sentence that says what is wrong; it never repeats the refused text, which may hold a secret. */
  readonly reason: string;
}

/**
 * Accepts a component, skill, agent, route or hook id only when it matches the M-03 allow-list.
 *
 * @param value - the candidate id
 * @returns the branded id, or the violation with the contracts sentence
 */
export function parseComponentName(value: string): Result<ComponentName, NameViolation> {
  const problem = idProblem(value);
  return problem === undefined ? succeed(value as ComponentName) : refuse({ kind: 'invalid-name', reason: problem });
}

/**
 * Accepts a path field from a component only when its text passes the M-03 rules for relative paths.
 *
 * The text check is not enough for a read or write: the real path on disk must still lie under the root (see
 * `resolveContainedPath`).
 *
 * @param value - the candidate path
 * @returns the branded path, or the violation with the contracts sentence
 */
export function parseRelativePath(value: string): Result<RelativePath, NameViolation> {
  const problem = relativePathProblem(value);
  return problem === undefined ? succeed(value as RelativePath) : refuse({ kind: 'invalid-path', reason: problem });
}
