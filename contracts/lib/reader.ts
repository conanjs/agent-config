// The tolerant reader of the contract files (specs/022 T055, FR-004, FR-005, CON-10, M-03, M-17). The installer, `build`,
// doctor and every provider's CI read `slots.yaml`, `component.yaml`, the two component lists and the lock through
// `readContract`, and the schema.json of each contract is held to the same verdicts by the parity test (DR-103).
import { type ContractDefinition, contractDefinitions } from './contract-shapes.ts';
import { DOCUMENT_FIELD, type Finding, type ReadResult, checkShape } from './shape.ts';
import { MAX_YAML_BYTES, readYaml, type YamlFinding } from './yaml.ts';

const CONTRACT_ID = /^([a-z0-9][a-z0-9-]*)\/v([1-9][0-9]*)$/;

const utf8 = new TextEncoder();

function failure(field: string, message: string): ReadResult {
  return { errors: [{ field, message }], warnings: [] };
}

/**
 * The majors of a contract a reader reads when asked for one: that major and the one before it (FR-006), if it has a shape.
 *
 * @param requested - the major asked for, for example 2
 * @param known - the majors the reader has a shape for
 * @returns the readable majors, newest first; for 2 with shapes for 1 and 2 that is `[2, 1]`
 */
export function readableMajors(requested: number, known: readonly number[]): readonly number[] {
  return [requested, requested - 1].filter((major) => known.includes(major));
}

/**
 * Checks the `schema: name/vN` key: it must name this contract and a major the reader reads.
 *
 * @param declared - the value of the `schema` key
 * @param name - the contract being read
 * @param readable - the majors the reader reads for it
 * @returns the major to read the file as, or the finding that says why the file is refused
 */
function schemaMajor(declared: unknown, name: string, readable: readonly number[]): number | Finding {
  const match = typeof declared === 'string' ? CONTRACT_ID.exec(declared) : null;
  if (match === null || match[1] !== name) {
    return { field: 'schema', message: `must be ${name}/v<major>, for example ${name}/v${readable[0] ?? 1}` };
  }
  const major = Number(match[2]);
  if (readable.includes(major)) return major;
  const reads = readable.map((each) => `v${each}`).join(' and ');
  return { field: 'schema', message: `is major v${major}; this reader reads ${reads}; skip this component (FR-005)` };
}

function describeYaml(finding: YamlFinding): Finding {
  const where = finding.line === undefined ? '' : ` (line ${finding.line})`;
  return { field: DOCUMENT_FIELD, message: `${finding.message}${where} [${finding.code}]` };
}

type Decoded =
  { readonly ok: true; readonly value: unknown } | { readonly ok: false; readonly findings: readonly Finding[] };

function decodeJson(text: string): Decoded {
  // The same size cap as YAML files (M-17): the lock lives in the home, but the reader does not trust any file's size.
  const bytes = utf8.encode(text).length;
  if (bytes > MAX_YAML_BYTES) {
    return {
      ok: false,
      findings: [
        { field: DOCUMENT_FIELD, message: `${bytes} bytes is over the ${MAX_YAML_BYTES} byte limit [TOO_LARGE]` },
      ],
    };
  }
  try {
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch (cause) {
    // The parser's own message quotes the text near the fault, which could be a secret, so it is not repeated (ERR-8).
    const message = cause instanceof RangeError ? 'nesting is too deep to read' : 'is not valid JSON';
    return { ok: false, findings: [{ field: DOCUMENT_FIELD, message }] };
  }
}

function decode(definition: ContractDefinition, text: string): Decoded {
  if (definition.format === 'json') return decodeJson(text);
  const read = readYaml(text);
  return read.ok ? read : { ok: false, findings: read.findings.map(describeYaml) };
}

function isMapping(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

interface Asked {
  readonly name: string;
  readonly major: number;
  readonly definition: ContractDefinition;
}

function lookup(id: string): Asked | undefined {
  const match = CONTRACT_ID.exec(id);
  const name = match?.[1] ?? '';
  const definition = Object.hasOwn(contractDefinitions, name) ? contractDefinitions[name] : undefined;
  return match === null || definition === undefined ? undefined : { name, major: Number(match[2]), definition };
}

function readMapping(asked: Asked, value: Readonly<Record<string, unknown>>): ReadResult {
  const known = Object.keys(asked.definition.majors).map(Number);
  const picked = schemaMajor(value['schema'], asked.name, readableMajors(asked.major, known));
  // An unsupported major is refused before its fields are read: the shape of a major this reader lacks is unknown (FR-005).
  if (typeof picked !== 'number') return { errors: [picked], warnings: [] };
  const shape = asked.definition.majors[picked];
  return shape === undefined
    ? failure('schema', 'has no shape in this reader')
    : checkShape(shape, value, DOCUMENT_FIELD);
}

/** Findings reported per list at most (Q-SEC-9): a hostile file with thousands of bad entries gets one more line, not a flood. */
export const MAX_FINDINGS = 50;

function capList(findings: readonly Finding[]): readonly Finding[] {
  if (findings.length <= MAX_FINDINGS) return findings;
  const more = findings.length - MAX_FINDINGS;
  return [...findings.slice(0, MAX_FINDINGS), { field: DOCUMENT_FIELD, message: `${more} more not shown` }];
}

function capped(result: ReadResult): ReadResult {
  return { errors: capList(result.errors), warnings: capList(result.warnings) };
}

/**
 * Reads the text of one contract file and says what is wrong with it.
 *
 * Unknown keys are warnings. Everything else is an error that names the field: bad ids and paths (M-03), an address that is not
 * a GitHub repository or holds a password (M-07), the old `count` and `mounts` keys of a slot with what replaced them
 * (AC-1.3), a `schema` that is not this contract or a major the reader does not read (FR-005), and the limits of the YAML
 * wrapper (M-17). A file is valid when `errors` is empty.
 *
 * @param id - the contract and major to read it as, `<name>/v<major>`, for example `component/v1`
 * @param text - the whole file, as read from disk
 * @returns the errors and warnings, in file order; nothing is thrown for a bad file
 */
export function readContract(id: string, text: string): ReadResult {
  return capped(readUncapped(id, text));
}

function readUncapped(id: string, text: string): ReadResult {
  // 1. The contract asked for must be one this reader knows.
  const asked = lookup(id);
  if (asked === undefined) {
    return failure(
      'id',
      'is not a contract this reader knows; use name/v<major> of slots, component, components-list or components-lock',
    );
  }
  // 2. Decode the file within the size and nesting limits.
  const decoded = decode(asked.definition, text);
  if (!decoded.ok) return { errors: decoded.findings, warnings: [] };
  if (!isMapping(decoded.value)) return failure(DOCUMENT_FIELD, 'must be a mapping of keys to values');
  // 3. Pick the shape from its `schema` key and check every field against it.
  return readMapping(asked, decoded.value);
}
