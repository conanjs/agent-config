// Small readers of a value the contract reader has already checked. They never invent a value for a key that is there: a text
// that is not text reads as the empty text, which every later rule refuses (an empty name never matches), so a drift between the
// reader's shape and these decoders fails closed and is caught by the decode tests over the contract examples.

/** A mapping with unknown values. */
export type Mapping = Readonly<Record<string, unknown>>;

/**
 * Treats a parsed value as a mapping so its keys can be read, or as an empty one when it is not.
 *
 * @param value - any parsed value
 * @returns the mapping, or an empty one when the value is not a mapping
 */
export function asMapping(value: unknown): Mapping {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Mapping) : {};
}

/**
 * Treats a parsed value as a list so its items can be read, or as an empty one when it is not.
 *
 * @param value - any parsed value
 * @returns the list, or an empty one when the value is not a list
 */
export function asList(value: unknown): readonly unknown[] {
  return Array.isArray(value) ? (value as readonly unknown[]) : [];
}

/**
 * Takes a parsed value as text, or the empty text when it is something else.
 *
 * @param value - any parsed value
 * @returns the text, or the empty text when the value is not text
 */
export function asText(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/**
 * Takes a parsed value as text when it is text, so a missing key stays missing.
 *
 * @param value - any parsed value
 * @returns the text, or `undefined` when the value is not text
 */
export function asOptionalText(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

/**
 * Takes the text items of a parsed list, dropping any item that is not text.
 *
 * @param value - any parsed value
 * @returns the texts of the list, in order; items that are not text are dropped
 */
export function asTextList(value: unknown): readonly string[] {
  return asList(value).filter((item): item is string => typeof item === 'string');
}

/**
 * Reads a true or false value.
 *
 * @param value - any parsed value
 * @param fallback - what a missing value means
 * @returns the flag, or the fallback when the value is not true or false
 */
export function asFlag(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

/**
 * Reads a mapping whose values are all texts.
 *
 * @param value - any parsed value
 * @returns a fresh mapping of the text values, own keys only
 */
export function asTextMap(value: unknown): Readonly<Record<string, string>> {
  const entries = Object.entries(asMapping(value)).filter(
    (entry): entry is [string, string] => typeof entry[1] === 'string',
  );
  return Object.fromEntries(entries);
}

/**
 * Reads a mapping whose values are all whole numbers.
 *
 * @param value - any parsed value
 * @returns a fresh mapping of the number values, own keys only
 */
export function asNumberMap(value: unknown): Readonly<Record<string, number>> {
  const entries = Object.entries(asMapping(value)).filter(
    (entry): entry is [string, number] => typeof entry[1] === 'number',
  );
  return Object.fromEntries(entries);
}
