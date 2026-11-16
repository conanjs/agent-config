// The one place that touches the YAML library (specs/022 T054, DR-102, DR-304). Every other module reads YAML through here.
// The library is the vendored copy of `yaml` 2.9.1 (contracts/lib/vendor/yaml/), so a provider's CI and the installer run
// the same bytes. The limits below are M-17's; the option names and their measured effects are in DR-606 and in
// copilot/knowledge/js-runtime/yaml-comment-round-trip.md.
// The relative path into vendor/ is the one IMP-1 exception, set for this file in contracts/eslint.config.mjs.
import { isScalar, parseDocument, visit } from './vendor/yaml/index.js';
import type { Document, YAMLError } from './vendor/yaml/index.js';

/** The `yaml` version the vendored copy was taken from; the unit test compares it with pnpm-lock.yaml and node_modules. */
export const YAML_VERSION = '2.9.1';

/** Largest text a contract file may have, in UTF-8 bytes (256 KiB, M-17): the library has no size option. */
export const MAX_YAML_BYTES = 262_144;

/** Findings reported per file at most, so a hostile file cannot flood the output with one error per nesting level. */
export const MAX_YAML_FINDINGS = 10;

/** Codes this wrapper adds; every other code is the library's own (`DUPLICATE_KEY`, `MULTIPLE_DOCS`, `TAG_RESOLVE_FAILED`...). */
export const YamlFailure = {
  TooLarge: 'TOO_LARGE',
  AliasRefused: 'ALIAS_REFUSED',
  ResourceExhausted: 'RESOURCE_EXHAUSTION',
  Unreadable: 'UNREADABLE',
  NonStringKey: 'NON_STRING_KEY',
  DuplicateKey: 'DUPLICATE_KEY',
} as const;

/** One reason a text is not accepted as a contract file. */
export interface YamlFinding {
  /** Stable code: one of {@link YamlFailure} or the library's own code. */
  readonly code: string;
  /** One line, without the source excerpt the library appends, so output stays one line per finding. */
  readonly message: string;
  /** 1-based line the library points at; absent when the failure is about the whole text. */
  readonly line: number | undefined;
}

/** Outcome of reading a text: the value, or every reason it was refused (an expected failure is a value, ERR-1). */
export type YamlResult<T> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly findings: readonly YamlFinding[] };

// DR-606 (A): the known tags are not resolved, so `!!binary` and `!!set` become a warning instead of a silent Buffer, and an
// unknown tag becomes `TAG_RESOLVE_FAILED`; there are no `customTags`. `logLevel: 'error'` and not 'silent': 'silent' skips
// the second-document check and drops the second document without an error. The rest are the defaults, written out so a
// future library default cannot loosen the limits without this file changing.
const parseOptions = {
  version: '1.2',
  schema: 'core',
  merge: false,
  // The library's own duplicate check compares every key with every earlier one, which takes seconds on a 256 KiB map
  // (measured 2026-11-14: 2.8 s), so it is off and `duplicateKeyFindings` does the same job in one pass.
  uniqueKeys: false,
  resolveKnownTags: false,
  logLevel: 'error',
} as const;

// `maxAliasCount` is a `toJS` option (not a parse option): 0 makes any alias an error. Contract files use no anchors or aliases.
const toJsOptions = { maxAliasCount: 0 } as const;

const utf8 = new TextEncoder();

// Q-SEC-5: the library's messages quote the text near the fault (a tag name, an escape, a directive), and that text may be a
// secret, so a finding carries a fixed sentence for the code and the line, never the library's message.
const LIBRARY_SENTENCES: Readonly<Record<string, string>> = {
  ALIAS_PROPS: 'an alias cannot have an anchor or a tag',
  BAD_ALIAS: 'an alias is not valid here',
  BAD_COLLECTION_TYPE: 'a collection has a tag that does not fit it',
  BAD_DIRECTIVE: 'a directive is not allowed in contract files',
  BAD_DQ_ESCAPE: 'a double-quoted text has an escape that is not valid',
  BAD_INDENT: 'the indentation is not valid',
  BAD_PROP_ORDER: 'an anchor or a tag is in the wrong place',
  BAD_SCALAR_START: 'a value starts with a character that is not allowed there',
  BLOCK_AS_IMPLICIT_KEY: 'a block cannot be a key',
  BLOCK_IN_FLOW: 'a block sits inside a flow collection',
  IMPOSSIBLE: 'the text cannot be read',
  KEY_OVER_1024_CHARS: 'a key is longer than 1024 characters',
  MISSING_CHAR: 'a character is missing, such as a closing bracket or quote',
  MULTILINE_IMPLICIT_KEY: 'a key spans more than one line',
  MULTIPLE_ANCHORS: 'a node has more than one anchor',
  MULTIPLE_DOCS: 'the file holds more than one document',
  MULTIPLE_TAGS: 'a node has more than one tag',
  RESOURCE_EXHAUSTION: 'nesting is too deep to read',
  NON_STRING_KEY: 'a key is not plain text',
  TAB_AS_INDENT: 'a tab is used as indentation',
  TAG_RESOLVE_FAILED: 'a tag is not allowed: contract files use no tags except the core ones',
  UNEXPECTED_TOKEN: 'the text has something that is not expected here',
};

const UNKNOWN_SENTENCE = 'the text is not valid YAML';

/**
 * Turns an error or warning of the library into a finding.
 *
 * @param error - what the library recorded on the document
 * @returns the finding, with the library's code and the line it points at
 */
function fromLibrary(error: YAMLError): YamlFinding {
  return {
    code: error.code,
    message: LIBRARY_SENTENCES[error.code] ?? UNKNOWN_SENTENCE,
    line: error.linePos?.[0].line,
  };
}

function wholeText(code: string, message: string): YamlFinding {
  return { code, message, line: undefined };
}

/**
 * Turns a failure thrown while parsing or converting into a finding: a stack overflow is the depth limit and an alias error is the
 * alias limit.
 *
 * @param error - whatever was thrown
 * @returns the finding for the whole text
 */
function fromThrown(error: unknown): YamlFinding {
  if (error instanceof RangeError) {
    return wholeText(YamlFailure.ResourceExhausted, 'nesting is too deep to read');
  }
  const message = error instanceof Error ? error.message : '';
  if (/alias/i.test(message)) {
    return wholeText(YamlFailure.AliasRefused, 'aliases (*name) are not allowed in contract files');
  }
  return wholeText(YamlFailure.Unreadable, 'the text could not be read');
}

// A null key (`~`, `null` or nothing) reads as the empty text in a plain object, so it repeats a key written "".
function keyText(value: string | number | boolean | bigint | null): string {
  return value === null ? '' : String(value);
}

function lineAt(text: string, offset: number): number {
  let line = 1;
  for (let index = text.indexOf('\n'); index !== -1 && index < offset; index = text.indexOf('\n', index + 1)) line += 1;
  return line;
}

/**
 * Finds keys that are not plain text and keys that repeat inside one mapping, in one pass over the document.
 *
 * Keys are compared by their text form, so `1` and `"1"`, `true` and `"true"`, `0x1` and `1`, and `007` and `7` all repeat each
 * other: a reader that turns every key into a string would otherwise silently keep only the last of them (M-17).
 *
 * @param document - the parsed document
 * @param text - the source text, for line numbers
 * @returns the findings, at most {@link MAX_YAML_FINDINGS}, in file order
 */
function keyFindings(document: Document, text: string): YamlFinding[] {
  const found: YamlFinding[] = [];
  visit(document, {
    Map(_key, map) {
      const seen = new Set<string>();
      for (const pair of map.items) {
        if (found.length >= MAX_YAML_FINDINGS) return visit.BREAK;
        const offset = (pair.key as { range?: readonly number[] | null } | null)?.range?.[0] ?? 0;
        if (!isScalar(pair.key)) {
          found.push({
            code: YamlFailure.NonStringKey,
            message: LIBRARY_SENTENCES['NON_STRING_KEY'] ?? '',
            line: lineAt(text, offset),
          });
        } else if (seen.has(keyText(pair.key.value as string | number | boolean | null))) {
          found.push({
            code: YamlFailure.DuplicateKey,
            message: 'a key appears twice in one mapping',
            line: lineAt(text, offset),
          });
        } else {
          seen.add(keyText(pair.key.value as string | number | boolean | null));
        }
      }
      return undefined;
    },
  });
  return found;
}

function refuse(findings: readonly YamlFinding[]): YamlResult<never> {
  return { ok: false, findings: findings.slice(0, MAX_YAML_FINDINGS) };
}

interface Loaded {
  readonly document: Document;
  readonly value: unknown;
}

function load(text: string): YamlResult<Loaded> {
  // 1. The size cap comes first: nothing is parsed from a text that is over it.
  const bytes = utf8.encode(text).length;
  if (bytes > MAX_YAML_BYTES) {
    return refuse([wholeText(YamlFailure.TooLarge, `${bytes} bytes is over the ${MAX_YAML_BYTES} byte limit`)]);
  }
  try {
    // 2. Parse. Errors and warnings both refuse the file: a warning is an unknown tag read as plain text (DR-606).
    const document = parseDocument(text, parseOptions);
    const problems = [...document.errors, ...document.warnings];
    if (problems.length > 0) return refuse(problems.map(fromLibrary));
    // 2b. Keys: the library's own check is off (see parseOptions), so duplicates and keys that are not text are found here.
    const keys = keyFindings(document, text);
    if (keys.length > 0) return refuse(keys);
    // 3. Convert with aliases refused. Done even when the caller wants the document to edit, so an alias never gets through.
    return { ok: true, value: { document, value: document.toJS(toJsOptions) as unknown } };
  } catch (error) {
    return refuse([fromThrown(error)]);
  }
}

/**
 * Reads one YAML document for reading, within the M-17 limits.
 *
 * The file is refused when it is over 256 KiB, has a tag (custom, `!!binary` or `!!set`), an alias, a duplicate key, a second
 * document, or nesting the library gives up on.
 *
 * @param text - the whole file
 * @returns the plain value (`null` for an empty file), or every finding with its code and line, at most ten
 */
export function readYaml(text: string): YamlResult<unknown> {
  const loaded = load(text);
  return loaded.ok ? { ok: true, value: loaded.value.value } : loaded;
}

/**
 * Reads one YAML document for editing with the comments kept, within the same M-17 limits as {@link readYaml}.
 *
 * @param text - the whole file
 * @returns the library's document, which the caller may change with `setIn` and print with `toString()`, or the findings
 */
export function readYamlDocument(text: string): YamlResult<Document> {
  const loaded = load(text);
  return loaded.ok ? { ok: true, value: loaded.value.document } : loaded;
}
