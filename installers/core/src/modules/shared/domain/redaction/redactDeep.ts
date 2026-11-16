import { escapeUnsafeText } from '#shared/domain/redaction/escapeUnsafeText.ts';
import { redact } from '#shared/domain/redaction/redact.ts';

/**
 * Hides credentials in a string and shows its control characters, so the text is safe to print or to put in a report.
 *
 * Credentials go first, on the raw text, because a header rule reads to the end of its line; then each control or bidi character
 * becomes a visible escape (M-07, M-11).
 *
 * @param text - one value
 * @returns the redacted, escaped value
 */
export function makePrintable(text: string): string {
  return escapeUnsafeText(redact(text));
}

/**
 * Applies {@link makePrintable} to every string inside a value, so a whole `--json` report is cleaned in one step: a C1 or bidi
 * character in a field is escaped there as well, which `JSON.stringify` alone does not do.
 *
 * Keys are made printable too, and a function value is dropped, so an own `toJSON` cannot survive into the output; arrays and
 * objects are copied, never changed in place.
 *
 * @param value - a string, or an array or plain object that holds strings
 * @returns a copy of the value with every string made printable
 */
export function redactDeep<Value>(value: Value): Value {
  if (typeof value === 'string') return makePrintable(value) as Value;
  if (Array.isArray(value)) return value.map((item: unknown) => redactDeep(item)) as Value;
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value)
      .filter(([, item]) => typeof item !== 'function')
      .map(([key, item]) => [makePrintable(key), redactDeep(item)] as const);
    return Object.fromEntries(entries) as Value;
  }
  return value;
}
