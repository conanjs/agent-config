import { secretNameWord, type SecretNameWord } from '#variables/domain/secrets/SecretRules.ts';
import { parseVariableValue, type ValueViolation } from '#variables/domain/value/VariableValue.ts';

/** What `doctor` found wrong with one row of the rendered variables table. */
export type PublicVariableProblem =
  | { readonly kind: 'secret-name'; readonly word: SecretNameWord }
  | { readonly kind: 'value'; readonly violation: ValueViolation };

/**
 * Re-checks one row of `generated/global-variables.md` against the M-08 rules, so a file edited by hand after `set` is caught by `doctor`.
 *
 * @param name - the variable name of the row
 * @param value - the value of the row
 * @returns the first problem, or `undefined` when the row is public text
 */
export function checkPublicVariable(name: string, value: string): PublicVariableProblem | undefined {
  const word = secretNameWord(name);
  if (word !== undefined) return { kind: 'secret-name', word };
  const checked = parseVariableValue(value);
  return checked.ok ? undefined : { kind: 'value', violation: checked.error };
}
