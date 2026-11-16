// The rules of a component list that the contract reader cannot say (components-list/v1 CL-3, M-03, M-05, M-07): it checks each
// entry alone, these look across the entries and at the machine the run is on.
import path from 'node:path';
import { isProtocolAllowed, type GitPolicy } from '#manifests/domain/rules/GitPolicy.ts';
import { findingSentence } from '#manifests/domain/rules/findingSentences.ts';
import { asList, asMapping, asText } from '#manifests/domain/decode/Fields.ts';
import type { ComponentList, ComponentSource, ListEntry, MergedEntry } from '#manifests/domain/model/ComponentList.ts';
import type { FileIssue } from '#manifests/domain/model/Issues.ts';
import { parseComponentName, type ContractFinding, type ContractParse } from '#shared/domain/name/NameRules.ts';
import type { PathFlavor } from '#shared/domain/path/PathContainment.ts';

// The sentence of contracts/lib/value-problems.ts that says a source address holds a user name or password (M-07). The test of this
// file reads a real reader finding for such an address, so a change of the sentence fails there and not silently here.
const CREDENTIAL_SENTENCE = 'keep credentials in git or ssh-agent (M-07)';
const SOURCE_URL_FIELD = /^components\[(\d+)\]\.source\.url$/;

function entryNameAt(value: unknown, index: number): string | undefined {
  const name = asText(asMapping(asList(asMapping(value)['components'])[index])['name']);
  return parseComponentName(name).ok ? name : undefined;
}

/**
 * Turns the findings of a list the contract reader refused into the issues V sees: a source address with credentials names the
 * component and nothing else (M-07), every other finding is a sentence about the list.
 *
 * @param parse - the refused read, with the parsed value when the YAML was readable
 * @returns one issue per finding, a component named for credentials at most once
 */
export function listIssuesOf(parse: Extract<ContractParse, { ok: false }>): readonly FileIssue[] {
  const named = new Set<string>();
  const issues: FileIssue[] = [];
  for (const finding of parse.findings) {
    const index = SOURCE_URL_FIELD.exec(finding.field)?.[1];
    const component =
      index === undefined || !finding.message.includes(CREDENTIAL_SENTENCE)
        ? undefined
        : entryNameAt(parse.value, Number(index));
    if (component === undefined) {
      issues.push({ kind: 'invalid', sentence: findingSentence(finding) });
    } else if (!named.has(component)) {
      named.add(component);
      issues.push({ kind: 'credentials', component });
    }
  }
  return issues;
}

function invalid(field: string, message: string): FileIssue {
  return { kind: 'invalid', sentence: findingSentence({ field, message } satisfies ContractFinding) };
}

function sourceIssue(
  source: ComponentSource,
  field: string,
  policy: GitPolicy,
  flavor: PathFlavor,
): FileIssue | undefined {
  if (source.type === 'path' && !path[flavor].isAbsolute(source.path)) {
    return invalid(`${field}.path`, 'must be an absolute folder');
  }
  if (source.type === 'git' && !isProtocolAllowed(policy, source.url)) {
    return invalid(
      `${field}.url`,
      `must start with ${policy.allowedProtocols.map((scheme) => `${scheme}://`).join(' or ')} (M-05)`,
    );
  }
  return undefined;
}

/**
 * Checks what the contract reader cannot: the `local` flag matches the file, no name appears twice, a `path` source is an absolute
 * folder and a git address uses an allowed transport.
 *
 * @param list - a list the contract reader accepted
 * @param expectLocal - true for components.local.yaml, false for components.yaml
 * @param policy - the git transports this run may use
 * @param flavor - the path syntax of the machine
 * @returns the issues in file order; none for a good list
 */
export function checkListEntries(
  list: ComponentList,
  expectLocal: boolean,
  policy: GitPolicy,
  flavor: PathFlavor,
): readonly FileIssue[] {
  const issues: FileIssue[] = [];
  if (list.local !== expectLocal)
    issues.push(invalid('local', expectLocal ? 'must be true in the local list' : 'must be false in the public list'));
  const seen = new Set<string>();
  list.entries.forEach((entry, index) => {
    const field = `components[${index}]`;
    if (seen.has(entry.name)) issues.push(invalid(`${field}.name`, 'appears twice in this list'));
    seen.add(entry.name);
    const found = sourceIssue(entry.source, `${field}.source`, policy, flavor);
    if (found !== undefined) issues.push(found);
  });
  return issues;
}

/**
 * Joins the public and the local list by name: a local entry wins and remembers the public source it replaced (CL-1, FR-019).
 *
 * @param publicList - components.yaml
 * @param localList - components.local.yaml, possibly absent
 * @returns the public entries in their order, each replaced by its local entry when there is one, then the local-only entries
 */
export function mergeLists(publicList: ComponentList, localList: ComponentList): readonly MergedEntry[] {
  const local = new Map<string, ListEntry>(localList.entries.map((entry) => [entry.name, entry]));
  const publicNames = new Set(publicList.entries.map((entry) => entry.name));
  const fromPublic = publicList.entries.map((entry): MergedEntry => {
    const winner = local.get(entry.name);
    return winner === undefined
      ? { name: entry.name, source: entry.source, origin: 'public', replaced: undefined }
      : { name: entry.name, source: winner.source, origin: 'local', replaced: entry.source };
  });
  const localOnly = localList.entries
    .filter((entry) => !publicNames.has(entry.name))
    .map((entry): MergedEntry => ({ name: entry.name, source: entry.source, origin: 'local', replaced: undefined }));
  return [...fromPublic, ...localOnly];
}

/**
 * Splits the merged entries into those a run can fetch and those it leaves out because their source type is not supported in this
 * release (AC-3.7); nothing of a skipped entry is fetched.
 *
 * @param entries - the merged entries
 * @returns the entries to read and the names of the archive entries to skip, in list order
 */
export function splitArchiveEntries(entries: readonly MergedEntry[]): {
  readonly usable: readonly MergedEntry[];
  readonly archiveNames: readonly string[];
} {
  return {
    usable: entries.filter((entry) => entry.source.type !== 'archive'),
    archiveNames: entries.filter((entry) => entry.source.type === 'archive').map((entry) => entry.name),
  };
}
