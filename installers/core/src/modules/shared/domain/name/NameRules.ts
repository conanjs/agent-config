// M-03 names and path fields as the installer reads them. The rules themselves are owned by contracts/lib (value-problems.ts);
// this file only turns their sentences into a Result and brands the accepted text, so a function that needs a checked name
// cannot be handed an unchecked string by mistake.
import { idProblem, relativePathProblem } from '../../../../../../../contracts/lib/value-problems.ts';
import { refuse, succeed, type Result } from '#shared/domain/result/Result.ts';
import { readContract } from '../../../../../../../contracts/lib/reader.ts';
import { MAX_YAML_BYTES, readYaml } from '../../../../../../../contracts/lib/yaml.ts';
import type { Finding } from '../../../../../../../contracts/lib/shape.ts';

/** A component, skill, agent, route or hook id that matches the M-03 allow-list. */
export type ComponentName = string & { readonly checkedAs: 'ComponentName' };

/** A path field from a component that is relative, with no `..` segment, drive letter, colon, backslash or NUL (M-03). */
export type RelativePath = string & { readonly checkedAs: 'RelativePath' };

/** Why a name or path field was refused. */
export interface NameViolation {
  /** Which kind of field was refused. */
  readonly kind: 'invalid-name' | 'invalid-path';
  /** The sentence that says what is wrong; it never repeats the refused text, which may hold a secret. */
  readonly reason: string;
}

/**
 * Accepts a component, skill, agent, route or hook id only when it matches the M-03 allow-list.
 *
 * @param value - the candidate id
 * @returns the branded id, or the violation with the contracts sentence
 */
export function parseComponentName(value: string): Result<ComponentName, NameViolation> {
  const problem = idProblem(value);
  return problem === undefined ? succeed(value as ComponentName) : refuse({ kind: 'invalid-name', reason: problem });
}

/**
 * Accepts a path field from a component only when its text passes the M-03 rules for relative paths.
 *
 * The text check is not enough for a read or write: the real path on disk must still lie under the root (see
 * `resolveContainedPath`).
 *
 * @param value - the candidate path
 * @returns the branded path, or the violation with the contracts sentence
 */
export function parseRelativePath(value: string): Result<RelativePath, NameViolation> {
  const problem = relativePathProblem(value);
  return problem === undefined ? succeed(value as RelativePath) : refuse({ kind: 'invalid-path', reason: problem });
}

/** One thing the contract reader found wrong, or tolerated, in a field of a contract file. */
export type ContractFinding = Finding;

/** The most bytes a contract file may have before the reader refuses it (M-17); a caller reads one byte more to show the oversize. */
export const MAX_CONTRACT_FILE_BYTES: number = MAX_YAML_BYTES;

/** The outcome of reading one contract file: the plain value when it is valid, else the findings and the value if the YAML was readable. */
export type ContractParse =
  | {
      readonly ok: true;
      readonly value: Readonly<Record<string, unknown>>;
      readonly warnings: readonly ContractFinding[];
    }
  | { readonly ok: false; readonly findings: readonly ContractFinding[]; readonly value: unknown };

/**
 * Reads the text of one contract file through the contract reader and returns the parsed mapping when it is valid.
 *
 * The verdict is the reader's alone (M-03, M-07, M-17, FR-005); this function only joins it with the value from the same YAML
 * wrapper, so no rule of contracts/lib is written twice (DR-304). An invalid file still gives its value when the YAML was readable,
 * so a caller can name the list entry that a finding is about.
 *
 * @param id - the contract and major, `name/v<major>`, for example `component/v1`
 * @param text - the whole file
 * @returns the valid mapping with its warnings, or the findings
 */
export function parseContractFile(id: string, text: string): ContractParse {
  const verdict = readContract(id, text);
  const yaml = readYaml(text);
  const value = yaml.ok ? yaml.value : undefined;
  if (verdict.errors.length > 0) return { ok: false, findings: verdict.errors, value };
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    // The reader accepted the text, so this cannot happen unless the two parses disagree; refuse rather than guess.
    return { ok: false, findings: [{ field: '(document)', message: 'must be a mapping of keys to values' }], value };
  }
  return { ok: true, value: value as Readonly<Record<string, unknown>>, warnings: verdict.warnings };
}
