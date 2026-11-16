// The tolerant checker behind the contract reader (specs/022 T055, CON-10): a contract is written once as a table of
// shapes (contract-shapes.ts) and this file checks a parsed value against it. Unknown keys warn and are ignored; every other
// failure is an error that names the field, so the message of a rejected file says where to look.
import { idProblem } from './value-problems.ts';

/** One finding about a field of the file read. */
export interface Finding {
  /** Where: a dotted path with list positions, for example `routes[0].read`; `(document)` for the whole file. */
  readonly field: string;
  /** What is wrong, in one sentence; it never repeats the value found. */
  readonly message: string;
}

/** What a read produced: the file is valid exactly when `errors` is empty; `warnings` never fail it. */
export interface ReadResult {
  /** What makes the file invalid; empty for a valid file. */
  readonly errors: readonly Finding[];
  /** Keys and values the reader ignores or tolerates; they never make a file invalid. */
  readonly warnings: readonly Finding[];
}

/** One key of a mapping: its shape, and whether the file must have it. */
export interface Field {
  /** What the value of the key must look like. */
  readonly shape: Shape;
  /** Whether a file without the key is an error. */
  readonly required: boolean;
}

/** What a value must look like. Each member is checked by the function of the same name in this file. */
export type Shape =
  | { readonly kind: 'text'; readonly problem?: (value: string) => string | undefined }
  | { readonly kind: 'flag' }
  | { readonly kind: 'whole'; readonly min: number }
  | { readonly kind: 'choice'; readonly values: readonly string[] }
  | { readonly kind: 'list'; readonly item: Shape; readonly min: number }
  | { readonly kind: 'map'; readonly values: Shape; readonly keyProblem?: (key: string) => string | undefined }
  | { readonly kind: 'nullable'; readonly shape: Shape }
  | { readonly kind: 'either'; readonly options: readonly Shape[]; readonly expected: string }
  | { readonly kind: 'object'; readonly fields: Readonly<Record<string, Field>>; readonly rules: ObjectRules }
  | { readonly kind: 'tagged'; readonly tag: string; readonly variants: Readonly<Record<string, Shape>> };

/** Extra rules of a mapping beyond its table of keys. */
export interface ObjectRules {
  /** Keys of an older form: each is an error whose message says what replaced it (AC-1.3). */
  readonly moved?: Readonly<Record<string, string>>;
  /** Rules between keys that a table cannot say, run on a mapping that passed its own checks. */
  readonly across?: (value: Readonly<Record<string, unknown>>, field: string) => readonly Finding[];
}

const none: ReadResult = { errors: [], warnings: [] };

/** The root marker of a finding about the whole file. */
export const DOCUMENT_FIELD = '(document)';

/** Shapes and fields, named for what they accept, so a contract table reads like the contract. */
export const shapes = {
  text: { kind: 'text' } as Shape,
  flag: { kind: 'flag' } as Shape,
  /**
   * A text that must match a pattern.
   *
   * @param pattern - what the text must match
   * @param rule - in words, what the pattern allows; it is the message when the text does not match
   * @returns the shape
   */
  matching: (pattern: RegExp, rule: string): Shape => ({
    kind: 'text',
    problem: (value) => (pattern.test(value) ? undefined : rule),
  }),
  /**
   * A text with its own allow-list rule, such as the id or path rules of value-problems.ts.
   *
   * @param problem - answers with a sentence when the text is not allowed, `undefined` when it is
   * @returns the shape
   */
  checked: (problem: (value: string) => string | undefined): Shape => ({ kind: 'text', problem }),
  whole: (min: number): Shape => ({ kind: 'whole', min }),
  choice: (...values: string[]): Shape => ({ kind: 'choice', values }),
  list: (item: Shape, min = 0): Shape => ({ kind: 'list', item, min }),
  map: (values: Shape, keyProblem?: (key: string) => string | undefined): Shape =>
    keyProblem === undefined ? { kind: 'map', values } : { kind: 'map', values, keyProblem },
  nullable: (shape: Shape): Shape => ({ kind: 'nullable', shape }),
  either: (expected: string, ...options: Shape[]): Shape => ({ kind: 'either', options, expected }),
  object: (fields: Readonly<Record<string, Field>>, rules: ObjectRules = {}): Shape => ({
    kind: 'object',
    fields,
    rules,
  }),
  tagged: (tag: string, variants: Readonly<Record<string, Shape>>): Shape => ({ kind: 'tagged', tag, variants }),
  required: (shape: Shape): Field => ({ shape, required: true }),
  optional: (shape: Shape): Field => ({ shape, required: false }),
};

/** The shape of an id, so a table says `shapes.id` and the M-03 rule stays written once. */
export const idShape: Shape = shapes.checked(idProblem);

function isMapping(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Joins a field path and a key: `locations` + `framework` gives `locations.framework`; the file's own path adds no prefix.
 *
 * @param field - the path of the mapping, empty or `(document)` for the whole file
 * @param key - a key inside it
 * @returns the path of that key
 */
export function within(field: string, key: string): string {
  return field === '' || field === DOCUMENT_FIELD ? key : `${field}.${key}`;
}

function error(field: string, message: string): ReadResult {
  return { errors: [{ field, message }], warnings: [] };
}

/**
 * Puts results side by side.
 *
 * @param results - the results to join, in order
 * @returns one result with every error and every warning, in the same order
 */
export function combine(results: readonly ReadResult[]): ReadResult {
  return {
    errors: results.flatMap((result) => result.errors),
    warnings: results.flatMap((result) => result.warnings),
  };
}

function checkText(shape: Extract<Shape, { kind: 'text' }>, value: unknown, field: string): ReadResult {
  if (typeof value !== 'string') return error(field, 'must be text');
  const problem = shape.problem?.(value);
  return problem === undefined ? none : error(field, problem);
}

function checkFlag(_shape: Extract<Shape, { kind: 'flag' }>, value: unknown, field: string): ReadResult {
  return typeof value === 'boolean' ? none : error(field, 'must be true or false');
}

function checkWhole(shape: Extract<Shape, { kind: 'whole' }>, value: unknown, field: string): ReadResult {
  const isWhole = typeof value === 'number' && Number.isInteger(value) && value >= shape.min;
  return isWhole ? none : error(field, `must be a whole number of ${shape.min} or more`);
}

function checkChoice(shape: Extract<Shape, { kind: 'choice' }>, value: unknown, field: string): ReadResult {
  const listed = typeof value === 'string' && shape.values.includes(value);
  return listed ? none : error(field, `must be one of: ${shape.values.join(', ')}`);
}

function checkList(shape: Extract<Shape, { kind: 'list' }>, value: unknown, field: string): ReadResult {
  if (!Array.isArray(value)) return error(field, 'must be a list');
  const entries = value as readonly unknown[];
  const tooShort = entries.length < shape.min ? error(field, `must have at least ${shape.min} entries`) : none;
  return combine([tooShort, ...entries.map((entry, index) => checkShape(shape.item, entry, `${field}[${index}]`))]);
}

function checkMap(shape: Extract<Shape, { kind: 'map' }>, value: unknown, field: string): ReadResult {
  if (!isMapping(value)) return error(field, 'must be a mapping');
  return combine(
    Object.entries(value).map(([key, entry]) => {
      const problem = shape.keyProblem?.(key);
      const at = within(field, key);
      return combine([
        problem === undefined ? none : error(at, `the key ${problem}`),
        checkShape(shape.values, entry, at),
      ]);
    }),
  );
}

function checkNullable(shape: Extract<Shape, { kind: 'nullable' }>, value: unknown, field: string): ReadResult {
  return value === null ? none : checkShape(shape.shape, value, field);
}

function checkEither(shape: Extract<Shape, { kind: 'either' }>, value: unknown, field: string): ReadResult {
  const fits = shape.options.some((option) => checkShape(option, value, field).errors.length === 0);
  return fits ? none : error(field, `must be ${shape.expected}`);
}

function checkFields(
  shape: Extract<Shape, { kind: 'object' }>,
  value: Readonly<Record<string, unknown>>,
  field: string,
): ReadResult {
  return combine(
    Object.entries(shape.fields).map(([key, rule]) => {
      const at = within(field, key);
      if (Object.hasOwn(value, key)) return checkShape(rule.shape, value[key], at);
      return rule.required ? error(at, 'is required') : none;
    }),
  );
}

function checkKeys(
  shape: Extract<Shape, { kind: 'object' }>,
  value: Readonly<Record<string, unknown>>,
  field: string,
): ReadResult {
  const moved = shape.rules.moved ?? {};
  const results = Object.keys(value).map((key): ReadResult => {
    if (Object.hasOwn(moved, key)) return error(within(field, key), moved[key] ?? '');
    if (Object.hasOwn(shape.fields, key)) return none;
    return {
      errors: [],
      warnings: [{ field: within(field, key), message: 'is not a key this reader knows and is ignored' }],
    };
  });
  return combine(results);
}

function checkObject(shape: Extract<Shape, { kind: 'object' }>, value: unknown, field: string): ReadResult {
  if (!isMapping(value)) return error(field, 'must be a mapping');
  const own = combine([checkFields(shape, value, field), checkKeys(shape, value, field)]);
  // The rules between keys run only on a mapping whose own keys are sound, so one mistake is reported once.
  if (own.errors.length > 0 || shape.rules.across === undefined) return own;
  return combine([own, { errors: shape.rules.across(value, field), warnings: [] }]);
}

function checkTagged(shape: Extract<Shape, { kind: 'tagged' }>, value: unknown, field: string): ReadResult {
  if (!isMapping(value)) return error(field, 'must be a mapping');
  const tagValue = value[shape.tag];
  const variant =
    typeof tagValue === 'string' && Object.hasOwn(shape.variants, tagValue) ? shape.variants[tagValue] : undefined;
  if (variant === undefined) {
    return error(within(field, shape.tag), `must be one of: ${Object.keys(shape.variants).join(', ')}`);
  }
  return checkShape(variant, value, field);
}

type Checkers = {
  readonly [K in Shape['kind']]: (shape: Extract<Shape, { kind: K }>, value: unknown, field: string) => ReadResult;
};

const checkers: Checkers = {
  text: checkText,
  flag: checkFlag,
  whole: checkWhole,
  choice: checkChoice,
  list: checkList,
  map: checkMap,
  nullable: checkNullable,
  either: checkEither,
  object: checkObject,
  tagged: checkTagged,
};

/**
 * Checks one parsed value against a shape.
 *
 * @param shape - what the value must look like
 * @param value - the parsed value, from the YAML wrapper or `JSON.parse`
 * @param field - where the value sits, as the finding names it; empty for the whole file
 * @returns every error and warning found, in file order; nothing is thrown for a value that does not fit
 */
export function checkShape(shape: Shape, value: unknown, field: string): ReadResult {
  // The table maps each kind to the function that takes exactly that member of the union, so the cast only joins them again.
  const check = checkers[shape.kind] as (shape: Shape, value: unknown, field: string) => ReadResult;
  return check(shape, value, field);
}
