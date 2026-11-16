// The text a hash of structured data is taken over (M-01: the approved privileged set is stored as the hash of its canonical
// text). Two equal values always give the same text, and two different values never do: keys are sorted, strings are JSON-escaped
// (nothing is joined with a separator that a value could contain), and every input that has two spellings or none is refused.

const MAX_DEPTH = 64;

function plainObject(value: object): value is Record<string, unknown> {
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function canonicalString(text: string): string {
  if (!text.isWellFormed()) throw new RangeError('canonicalJson: a string is not well-formed Unicode (lone surrogate)');
  return JSON.stringify(text);
}

function canonicalNumber(value: number): string {
  if (!Number.isFinite(value)) throw new RangeError('canonicalJson: NaN and Infinity have no JSON form');
  if (Object.is(value, -0)) throw new RangeError('canonicalJson: -0 has two spellings; write 0');
  return JSON.stringify(value);
}

function canonicalObject(value: Record<string, unknown>, depth: number): string {
  const members = Object.keys(value)
    .sort()
    .map((key) => `${canonicalString(key)}:${canonicalValue(value[key], depth + 1)}`);
  return `{${members.join(',')}}`;
}

function canonicalValue(value: unknown, depth: number): string {
  if (depth > MAX_DEPTH) throw new RangeError('canonicalJson: the value is nested too deeply or refers to itself');
  if (value === null) return 'null';
  if (typeof value === 'string') return canonicalString(value);
  if (typeof value === 'number') return canonicalNumber(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  // Array.from turns a hole of a sparse array into undefined, which canonicalValue then refuses.
  if (Array.isArray(value))
    return `[${Array.from(value as unknown[], (item) => canonicalValue(item, depth + 1)).join(',')}]`;
  if (typeof value === 'object' && plainObject(value)) return canonicalObject(value, depth);
  throw new TypeError(
    'canonicalJson: only null, booleans, numbers, strings, arrays and plain objects have a canonical form',
  );
}

/**
 * Writes a value as its one canonical JSON text: object keys sorted (by UTF-16 code unit, recursively), no white space, strings
 * escaped by `JSON.stringify`.
 *
 * It throws instead of guessing for a lone surrogate (in a string or a key), NaN, Infinity, `-0`, `undefined`, a function, a
 * symbol, a bigint, a class instance, and a value nested deeper than 64 levels or that contains itself. These are programming
 * errors in the caller, not input from a component.
 *
 * @param value - data made of null, booleans, numbers, strings, arrays and plain objects
 * @returns the canonical text, ready to hash with `sha256Hex`
 */
export function canonicalJson(value: unknown): string {
  return canonicalValue(value, 0);
}
