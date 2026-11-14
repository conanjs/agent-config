// The shape of each contract file the reader knows (specs/022 T055): slots/v1, component/v1, components-list/v1 and
// components-lock/v1, from the sketches in specs/022-repo-split/contracts/ and the entities in data-model.md. A contract added
// later (T062 onward) adds its table here and its name to `contractDefinitions`; the reader itself does not change.
import { type Finding, type Shape, idShape, shapes, within } from './shape.ts';
import {
  githubUrlProblem,
  homeRelativePathProblem,
  idProblem,
  localPathProblem,
  relativePathProblem,
  sourceUrlProblem,
} from './value-problems.ts';

const { text, flag, checked, matching, choice, list, map, nullable, either, object, tagged, whole } = shapes;
const { required, optional } = shapes;

const path = checked(relativePathProblem);
const contractName = matching(
  /^[a-z0-9][a-z0-9-]*\/v[1-9][0-9]*$/,
  'must look like name/v1: a contract name, /v, a major number',
);
const scope = choice('global', 'per-project');
const schemaKey = required(text);

// M-05: a branch or tag name never starts with -, so git cannot read it as an option; no whitespace or control character.
const refName = matching(
  /^[A-Za-z0-9_.][A-Za-z0-9_./+@-]*$/,
  'must be a branch or tag name, not starting with - (M-05)',
);
const sha256 = matching(/^[0-9a-f]{64}$/, 'must be 64 lowercase hexadecimal characters');

const gitSource = object({
  type: required(text),
  url: required(checked((value) => sourceUrlProblem(value, ['https', 'ssh']))),
  ref: required(refName),
});
const archiveSource = object({
  type: required(text),
  url: required(checked((value) => sourceUrlProblem(value, ['https']))),
  sha256: required(sha256),
});

/** The sources of a list entry and of a lock entry (CL-3, CL-4, M-05, M-07). */
const source = tagged('type', {
  git: gitSource,
  path: object({ type: required(text), path: required(checked(localPathProblem)) }),
  archive: archiveSource,
});

/** A suggested source is shown and never fetched (CM-6, AC-4.5), so it cannot point at a folder of V's machine. */
const suggestedSource = tagged('type', { git: gitSource, archive: archiveSource });

// ---- slots/v1 (slots-v1.md, data-model "Slot") ----------------------------------------------------------

const location = object({
  name: required(idShape),
  mount: required(path),
  required: optional(flag),
  shared: optional(flag),
  index: optional(choice('provided', 'generated')),
});

const slot = object(
  {
    name: required(idShape),
    reserved: optional(flag),
    contract: required(either('a contract name or a list of contract names', contractName, list(contractName, 1))),
    required: required(flag),
    multiple: required(flag),
    scope: required(scope),
    'self-contained': optional(flag),
    locations: required(list(location, 1)),
  },
  {
    moved: {
      count: '`count` is now `required` + `multiple`',
      mounts: '`mounts` is now `locations`',
    },
  },
);

const slotsV1 = object({ schema: schemaKey, slots: required(list(slot, 1)) });

// ---- component/v1 (component-v1.md, data-model "Component") --------------------------------------------

const service = object({
  kind: required(choice('mcp')),
  name: required(idShape),
  command: required(text),
  args: optional(list(text)),
});

const slotDependency = object({
  slot: required(idShape),
  contract: required(contractName),
  required: optional(flag),
  docs: optional(list(path)),
  suggest: optional(object({ source: required(suggestedSource) })),
});

const route = object({
  id: required(idShape),
  when: required(text),
  read: required(path),
  'before-writing': optional(path),
});

const hook = object({
  id: required(idShape),
  event: required(choice('session-start', 'pre-tool', 'prompt-submit', 'stop')),
  agents: optional(list(choice('claude-code', 'copilot-cli', 'codex'))),
  command: required(text),
  matcher: optional(nullable(text)),
});

// CM-7, M-18: a variable is found by looking, never by running a command, so only these two forms exist.
const detect = tagged('kind', {
  env: object({ kind: required(text), name: required(text) }),
  'dir-exists': object({ kind: required(text), candidates: required(list(checked(homeRelativePathProblem), 1)) }),
});

const variable = object({
  name: required(matching(/^[A-Z][A-Z0-9_]*$/, 'must be upper snake case, such as REFERENCE_REPOS_ROOT')),
  description: required(text),
  required: optional(flag),
  detect: optional(detect),
});

const provides = object({
  contracts: optional(list(contractName)),
  index: optional(path),
  exports: optional(list(path)),
  skills: optional(path),
  agents: optional(path),
  services: optional(list(service)),
});

/**
 * CM-4: a component that exports docs says where they live, because citation targets are built from `repository`.
 *
 * @param value - the component mapping, whose own keys already passed
 * @param field - the path of that mapping
 * @returns one finding when `provides.exports` is not empty and `repository` is missing
 */
function repositoryWhenExporting(value: Readonly<Record<string, unknown>>, field: string): readonly Finding[] {
  const exported = (value['provides'] as { exports?: unknown } | undefined)?.exports;
  const exports = Array.isArray(exported) ? (exported as readonly unknown[]) : [];
  const missing = exports.length > 0 && !Object.hasOwn(value, 'repository');
  return missing
    ? [{ field: within(field, 'repository'), message: 'is required when provides.exports is not empty (CM-4)' }]
    : [];
}

const componentV1 = object(
  {
    schema: schemaKey,
    name: required(idShape),
    version: required(
      matching(/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?$/, 'must be a version such as 1.4.0'),
    ),
    slot: required(idShape),
    repository: optional(checked(githubUrlProblem)),
    scope: optional(scope),
    contracts: required(object({ pin: required(whole(1)) })),
    locations: required(map(path, idProblem)),
    provides: optional(provides),
    depends: optional(object({ slots: optional(list(slotDependency)), runtime: optional(map(text)) })),
    routes: optional(list(route)),
    hooks: optional(list(hook)),
    variables: optional(list(variable)),
    'idle-cost': optional(map(whole(0))),
  },
  { across: repositoryWhenExporting },
);

// ---- components-list/v1 (components-list-and-lock-v1.md) ---------------------------------------------------

const listEntry = object({ name: required(idShape), source: required(source) });

const componentsListV1 = object({
  schema: schemaKey,
  // Required because both shipped examples (tests/contracts/fixtures/base/components.yaml and components.local.yaml) carry it.
  local: required(flag),
  components: required(list(listEntry)),
});

// ---- components-lock/v1 ------------------------------------------------------------------------------------

// What the installer locked: a git commit, a live path (with its path), or an archive hash. `live: false` is not a location.
function resolvedWhere(value: Readonly<Record<string, unknown>>, field: string): readonly Finding[] {
  const isGit = Object.hasOwn(value, 'commit');
  const isLivePath = value['live'] === true && Object.hasOwn(value, 'path');
  const isArchive = Object.hasOwn(value, 'sha256');
  return isGit || isLivePath || isArchive
    ? []
    : [{ field, message: 'must have commit (git), live: true with path (path source) or sha256 (archive)' }];
}

const resolved = object(
  {
    commit: optional(matching(/^[0-9a-f]{40}$/, 'must be 40 hexadecimal characters')),
    tag: optional(refName),
    live: optional(flag),
    path: optional(checked(localPathProblem)),
    sha256: optional(sha256),
  },
  { across: resolvedWhere },
);

const lockEntry = object({
  source: required(source),
  resolved: required(resolved),
  manifest: optional(
    object({ version: required(text), slot: required(idShape), contracts: required(list(contractName)) }),
  ),
  build: optional(
    nullable(
      object({
        source_sha: required(text),
        build: required(whole(1)),
        adapters: required(map(whole(1))),
      }),
    ),
  ),
  store_id: optional(matching(/^[0-9a-f]{12}$/, 'must be 12 hexadecimal characters')),
});

const componentsLockV1 = object({
  schema: schemaKey,
  components: required(map(lockEntry, idProblem)),
});

/** How a contract file is written on disk, and so how the reader decodes it. */
export type FileFormat = 'yaml' | 'json';

/** One contract: its file format and its shape for each major this reader can read. */
export interface ContractDefinition {
  /** Whether the file is YAML (read with the wrapper) or JSON (the lock, written by the installer). */
  readonly format: FileFormat;
  /** The current major, then the previous one if the reader still reads it (FR-006). */
  readonly majors: Readonly<Record<number, Shape>>;
}

/** The contracts the reader knows, by name. */
export const contractDefinitions: Readonly<Record<string, ContractDefinition>> = {
  slots: { format: 'yaml', majors: { 1: slotsV1 } },
  component: { format: 'yaml', majors: { 1: componentV1 } },
  'components-list': { format: 'yaml', majors: { 1: componentsListV1 } },
  'components-lock': { format: 'json', majors: { 1: componentsLockV1 } },
};
