// `set NAME=value` (AC-6.1, AC-6.3, M-08, VR-3, VR-4) as one pure pipeline: parse, refuse secrets, check the name is declared, check
// the value, make the new file text. The command (T140) loads the values first and, on success, backs up and writes the text through
// the state module; nothing here touches a disk, so a refusal changes nothing by construction.
import { refuse, succeed, type Result } from '#shared/domain/result/Result.ts';
import { parseAssignment } from '#variables/domain/assignment/parseAssignment.ts';
import type { DeclaredVariable } from '#variables/domain/declaration/DeclaredVariables.ts';
import { emitValuesFile, type VariableValues } from '#variables/domain/file/ValuesFile.ts';
import { MAX_VARIABLE_NAME_LENGTH, type VariableName } from '#variables/domain/name/VariableName.ts';
import {
  secretNameWord,
  secretValuePrefix,
  type SecretNameWord,
  type SecretValuePrefix,
} from '#variables/domain/secrets/SecretRules.ts';
import { closestNames } from '#variables/domain/suggestion/closestNames.ts';
import { parseVariableValue, type ValueViolation } from '#variables/domain/value/VariableValue.ts';

/** What `set` needs: the argument as typed, the declared variables of the enabled components and V's current values. */
export interface SetRequest {
  /** The text after `set`, as V typed it. */
  readonly argument: string;
  /** The declared variables of the enabled components. */
  readonly declared: readonly DeclaredVariable[];
  /** V's values now. */
  readonly current: VariableValues;
}

/** The outcome of an accepted `set`. */
export interface SetPlan {
  /** The declared name that was set. */
  readonly name: VariableName;
  /** The whole new `variables.local.yaml`; other values are kept, and the file is sorted by name. */
  readonly fileText: string;
  /** False when the stored value is already this one. */
  readonly changed: boolean;
}

/**
 * Why `set` refused. `name` is what V typed, cut to 128 characters; it is printed through the message catalogue, which escapes it.
 * No refusal holds the value, so none can print it (M-08).
 */
export type SetRefusal =
  | { readonly kind: 'usage'; readonly reason: 'no-equals-sign' | 'no-name' }
  | { readonly kind: 'secret-name'; readonly name: string; readonly word: SecretNameWord }
  | { readonly kind: 'secret-value'; readonly name: string; readonly prefix: SecretValuePrefix }
  | { readonly kind: 'undeclared'; readonly name: string; readonly closest: readonly string[] }
  | {
      readonly kind: 'invalid-value';
      readonly name: string;
      readonly violation: Exclude<ValueViolation, { kind: 'secret-prefix' }>;
    };

function shown(name: string): string {
  return name.length > MAX_VARIABLE_NAME_LENGTH ? `${name.slice(0, MAX_VARIABLE_NAME_LENGTH)}...` : name;
}

/**
 * Turns one `set` argument into the new values file, or the refusal that stores nothing. The order is the one of MG-36: the secret checks first (name, then value start), then the declared
 * check with the closest names, then the rest of the value rules.
 *
 * @param request - the argument and the facts it is checked against
 * @returns the new file text to store, or the refusal
 */
export function planSetVariable(request: SetRequest): Result<SetPlan, SetRefusal> {
  // 1. Split at the first `=`.
  const assignment = parseAssignment(request.argument);
  if (!assignment.ok) return refuse({ kind: 'usage', reason: assignment.error.kind });
  const { name, value } = assignment.value;
  // 2. Secrets first, so a secret-like name or value is refused whether or not it is declared (M-08).
  const word = secretNameWord(name);
  if (word !== undefined) return refuse({ kind: 'secret-name', name: shown(name), word });
  const prefix = secretValuePrefix(value);
  if (prefix !== undefined) return refuse({ kind: 'secret-value', name: shown(name), prefix });
  // 3. The name must be declared by an enabled component.
  const declared = request.declared.find((variable) => variable.name === name);
  if (declared === undefined) {
    return refuse({
      kind: 'undeclared',
      name: shown(name),
      closest: closestNames(
        name,
        request.declared.map((variable) => variable.name),
      ),
    });
  }
  // 4. The rest of the value rules.
  const checked = parseVariableValue(value);
  if (!checked.ok) {
    return checked.error.kind === 'secret-prefix'
      ? refuse({ kind: 'secret-value', name: declared.name, prefix: checked.error.prefix })
      : refuse({ kind: 'invalid-value', name: declared.name, violation: checked.error });
  }
  // 5. The new file: the same values with this one changed.
  const next = new Map(request.current);
  next.set(declared.name, checked.value);
  return succeed({
    name: declared.name,
    fileText: emitValuesFile(next),
    changed: request.current.get(declared.name) !== checked.value,
  });
}
