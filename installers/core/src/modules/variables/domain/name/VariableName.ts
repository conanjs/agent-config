// A variable name as the installer reads it (variables/v1): upper snake case, short, and never the one name the installer computes.
// The brand means a function that needs a checked name cannot be handed an unchecked string by mistake.
import { refuse, succeed, type Result } from '#shared/domain/result/Result.ts';

/** A variable name that matches `^[A-Z][A-Z0-9_]*$`, is at most {@link MAX_VARIABLE_NAME_LENGTH} characters and is not reserved. */
export type VariableName = string & { readonly checkedAs: 'VariableName' };

/** The longest variable name accepted; it also bounds the work of the closest-name search on a hostile command line. */
export const MAX_VARIABLE_NAME_LENGTH = 128;

/** The variable the installer computes from the agent home: a component cannot declare it and `set` cannot store it. */
export const AGENT_HOME_NAME = 'AGENT_HOME';

/** Why a text was refused as a variable name; the sentence never repeats the refused text, which may hold a secret. */
export interface VariableNameViolation {
  /** `invalid-name` when the text is not upper snake case or is too long; `reserved-name` for the computed `AGENT_HOME`. */
  readonly kind: 'invalid-name' | 'reserved-name';
  /** What is wrong, in one sentence. */
  readonly reason: string;
}

const UPPER_SNAKE_CASE = /^[A-Z][A-Z0-9_]*$/;

/**
 * Accepts a variable name only when it is upper snake case, at most 128 characters, and not the computed `AGENT_HOME`.
 *
 * @param text - the candidate name, as a component declares it
 * @returns the branded name, or the violation (its sentence never repeats the text)
 */
export function parseVariableName(text: string): Result<VariableName, VariableNameViolation> {
  if (text.length > MAX_VARIABLE_NAME_LENGTH || !UPPER_SNAKE_CASE.test(text)) {
    return refuse({
      kind: 'invalid-name',
      reason: `a variable name must be upper snake case such as REFERENCE_REPOS_ROOT, at most ${MAX_VARIABLE_NAME_LENGTH} characters`,
    });
  }
  if (text === AGENT_HOME_NAME) {
    return refuse({ kind: 'reserved-name', reason: 'AGENT_HOME is computed by the installer and cannot be declared' });
  }
  return succeed(text as VariableName);
}
