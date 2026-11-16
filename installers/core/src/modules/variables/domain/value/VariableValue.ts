// M-08, M-11, M-07: a value is public text that every agent loads and that is printed in a table, so it must be one safe line with
// no credential in it. The checks are text-only; the sentence of a refusal never repeats the value.
// FOR T137 (the renderer, M-08, T-07): put each value into the table in ONE pass and never expand a placeholder inside a value. A
// value such as `{{include:secret.md}}` or `{{OTHER}}` is text, not a template; a second substitution pass would turn a public value
// into a way to read another file or variable into the file every agent loads.
import { escapeUnsafeText } from '#shared/domain/redaction/escapeUnsafeText.ts';
import { needsRedaction } from '#shared/domain/redaction/redact.ts';
import { refuse, succeed, type Result } from '#shared/domain/result/Result.ts';
import { secretValuePrefix, secretValueShape, type SecretValuePrefix } from '#variables/domain/secrets/SecretRules.ts';

/** A value that passed {@link parseVariableValue}: one line, bounded, with no control character and no credential-like text. */
export type VariableValue = string & { readonly checkedAs: 'VariableValue' };

/** The longest value accepted, in characters; a path or a language name is far shorter. */
export const MAX_VARIABLE_VALUE_LENGTH = 1024;

/** Why a value was refused. Only `secret-prefix` carries the prefix (a fixed word from the list), and no kind carries the value. */
export type ValueViolation =
  | { readonly kind: 'secret-prefix'; readonly prefix: SecretValuePrefix; readonly reason: string }
  | {
      readonly kind: 'empty' | 'too-long' | 'unsafe-characters' | 'credential-like' | 'secret-shape';
      readonly reason: string;
    };

/**
 * Accepts a value only when it is public text: not empty, at most 1024 characters, no control, bidi or invisible character, no
 * lone surrogate, no secret-like prefix and no credential-like text (a URL with a password, a `token=` parameter, a bearer header).
 *
 * The checks run in that order, so a value that is both too long and a token reports the token.
 *
 * @param text - the value V typed, a value read from `variables.local.yaml` or a proposal from the old variables file
 * @returns the branded value, or the first violation
 */
export function parseVariableValue(text: string): Result<VariableValue, ValueViolation> {
  const prefix = secretValuePrefix(text);
  if (prefix !== undefined) {
    return refuse({
      kind: 'secret-prefix',
      prefix,
      reason: `the value starts with ${prefix}; variables are public values that every agent reads`,
    });
  }
  const shape = secretValueShape(text);
  if (shape !== undefined) {
    return refuse({
      kind: 'secret-shape',
      reason: `the value looks like ${shape}; variables are public values that every agent reads`,
    });
  }
  if (text === '') return refuse({ kind: 'empty', reason: 'the value is empty' });
  if (text.length > MAX_VARIABLE_VALUE_LENGTH) {
    return refuse({ kind: 'too-long', reason: `the value is longer than ${MAX_VARIABLE_VALUE_LENGTH} characters` });
  }
  if (escapeUnsafeText(text) !== text || !text.isWellFormed()) {
    return refuse({
      kind: 'unsafe-characters',
      reason:
        'the value has a control, line-break or invisible character, which would print as another line or hide text',
    });
  }
  if (needsRedaction(text)) {
    return refuse({
      kind: 'credential-like',
      reason: 'the value has credential-like text; variables are public values that every agent reads',
    });
  }
  return succeed(text as VariableValue);
}
