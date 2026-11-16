// `variables.local.yaml` (schema variables-local/v1): V's values, one per name, written by `set` and never tracked. The text is
// written by this file and read through the hardened YAML reader of contracts/lib (M-17), which the caller supplies as parsed data;
// so nothing here parses YAML, and nothing here can be made to run code by a hostile file.
import { refuse, succeed, type Result } from '#shared/domain/result/Result.ts';
import { parseVariableName, type VariableName } from '#variables/domain/name/VariableName.ts';
import { secretNameWord } from '#variables/domain/secrets/SecretRules.ts';
import { parseVariableValue, type VariableValue } from '#variables/domain/value/VariableValue.ts';

/** The `schema:` line the file carries. */
export const VALUES_FILE_SCHEMA = 'variables-local/v1';

/** V's stored values by name. A value is never changed in place: `set` makes a new map. */
export type VariableValues = ReadonlyMap<VariableName, VariableValue>;

/** Why the content of the file cannot be used; the sentence never repeats a value, and names a variable only when its name is valid. */
export interface ValuesFileViolation {
  /** Which rule the file broke. */
  readonly kind: 'wrong-schema' | 'wrong-shape' | 'bad-entry';
  /** The sentence that says what is wrong. */
  readonly reason: string;
}

// A scalar that every YAML 1.2 reader takes as text: it starts with a letter, `/` or `~` (never a digit, so it is no number), and
// holds only letters, digits, space and a few path characters. No `:`, `#`, quote, backslash or indicator can occur, so nothing needs escaping.
const PLAIN_SAFE = /^[A-Za-z/~][A-Za-z0-9 _./~-]*$/;
const WORDS_READ_AS_OTHER_TYPES = /^(true|false|null|yes|no|on|off|y|n|nan|inf)$/i;
const KEYS_READ_AS_OTHER_TYPES = new Set(['NULL', 'TRUE', 'FALSE']);

function scalar(value: string): string {
  const plain =
    PLAIN_SAFE.test(value) && !value.endsWith(' ') && value !== '~' && !WORDS_READ_AS_OTHER_TYPES.test(value);
  // JSON text is a YAML double-quoted scalar; the value holds no control character (parseVariableValue), so every escape is `\"` or `\\`.
  return plain ? value : JSON.stringify(value);
}

/**
 * Writes the text of `variables.local.yaml` for a set of values: the schema line, then a `values:` map sorted by name.
 *
 * A value is written as plain text when every YAML reader gives the same text back (`English`, `/data/alpha`, `~/ws/ref`), and as a
 * double-quoted text otherwise (`yes`, `8080`, `a: b`, a URL, a Windows path). The same values always give the same bytes.
 *
 * @param values - the values to keep
 * @returns the whole file, ending in a line feed
 */
export function emitValuesFile(values: VariableValues): string {
  const names = [...values.keys()].sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
  const body =
    names.length === 0
      ? ['values: {}']
      : [
          'values:',
          ...names.map(
            (name) =>
              `  ${KEYS_READ_AS_OTHER_TYPES.has(name) ? JSON.stringify(name) : name}: ${scalar(values.get(name) ?? '')}`,
          ),
        ];
  return [`schema: ${VALUES_FILE_SCHEMA}`, ...body, ''].join('\n');
}

function isPlainObject(raw: unknown): raw is Readonly<Record<string, unknown>> {
  return typeof raw === 'object' && raw !== null && !Array.isArray(raw);
}

// One `NAME: value` entry of the map, checked as `set` would check it.
function readEntry(key: string, entry: unknown): Result<readonly [VariableName, VariableValue], ValuesFileViolation> {
  const name = parseVariableName(key);
  if (!name.ok)
    return refuse({ kind: 'bad-entry', reason: `a key of values is not a variable name: ${name.error.reason}` });
  if (secretNameWord(name.value) !== undefined) {
    return refuse({
      kind: 'bad-entry',
      reason: `the name ${name.value} is secret-like; variables are public values (M-08)`,
    });
  }
  if (typeof entry !== 'string') {
    return refuse({ kind: 'bad-entry', reason: `the value of ${name.value} must be text; put it in double quotes` });
  }
  const value = parseVariableValue(entry);
  return value.ok
    ? succeed([name.value, value.value])
    : refuse({ kind: 'bad-entry', reason: `the value of ${name.value} is refused: ${value.error.reason}` });
}

// The `values:` map of a document whose schema line is right; absent or null is "no values yet".
function readValuesMap(raw: unknown): Result<VariableValues, ValuesFileViolation> {
  if (raw === undefined || raw === null) return succeed(new Map());
  if (!isPlainObject(raw)) return refuse({ kind: 'wrong-shape', reason: 'values must be a map of NAME: value' });
  const values = new Map<VariableName, VariableValue>();
  for (const [key, entry] of Object.entries(raw)) {
    const read = readEntry(key, entry);
    if (!read.ok) return read;
    values.set(read.value[0], read.value[1]);
  }
  return succeed(values);
}

/**
 * Reads the values of `variables.local.yaml` from the plain data of its parsed text.
 *
 * Every name must be a valid variable name that is not secret-like and every value must be text that passes the value rules, so a
 * file edited by hand cannot put a credential, a control character or a number into the rendered table (M-08). An empty file and a
 * file with no `values:` are accepted as "no values yet"; any other schema is refused.
 *
 * @param parsed - the plain value the YAML reader returned (`null` for an empty file)
 * @returns the values, or why the file is refused as a whole
 */
export function readValuesFile(parsed: unknown): Result<VariableValues, ValuesFileViolation> {
  if (parsed === null || parsed === undefined) return succeed(new Map());
  if (!isPlainObject(parsed))
    return refuse({ kind: 'wrong-shape', reason: 'the file is not a map with schema and values' });
  if (parsed['schema'] !== VALUES_FILE_SCHEMA) {
    return refuse({ kind: 'wrong-schema', reason: `the file must start with "schema: ${VALUES_FILE_SCHEMA}"` });
  }
  return readValuesMap(parsed['values']);
}
