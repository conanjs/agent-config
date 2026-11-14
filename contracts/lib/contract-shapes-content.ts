// The shape of the content contracts the reader knows (specs/022): knowledge-provider, company-kb, rendered-copy, skill-source, agent-source and adapter-fields (T062 to T064, T066 to T068).
// contract-registry.ts joins this table with the core and the other one; shared parts come from contract-shapes.ts.
// The sketches in specs/022-repo-split/contracts/ describe rules, and for some of these contracts no file; each contract here
// reads one small declaration file (named in its README) so that the rules and the worked examples are checkable.
// Every pattern below is written twice on purpose, here and in that contract's schema.json; the parity test keeps them equal.
import { type ContractDefinition, contractName, path, schemaKey } from './contract-shapes.ts';
import { idShape, shapes } from './shape.ts';
import { githubUrlProblem, relativePathProblem, sourceUrlProblem } from './value-problems.ts';

const { text, flag, checked, matching, choice, list, map, either, object, whole } = shapes;
const { required, optional } = shapes;

const AGENT_HOME_PREFIX = '{{AGENT_HOME}}/';

/**
 * Checks a citation's link text in the source form: `{{AGENT_HOME}}/` and then a contained relative path (KP-6, M-03).
 *
 * @param value - the candidate link text
 * @returns what is wrong with it, or `undefined`
 */
export function agentHomeCitationProblem(value: string): string | undefined {
  const rest = value.slice(AGENT_HOME_PREFIX.length);
  if (!value.startsWith(AGENT_HOME_PREFIX) || rest === '' || rest.startsWith('/')) {
    return `must be ${AGENT_HOME_PREFIX} followed by a path inside a component`;
  }
  return relativePathProblem(value);
}

const githubFileUrl = matching(
  /^https:\/\/github\.com\/[A-Za-z0-9][A-Za-z0-9-]{0,38}\/[A-Za-z0-9._-]{1,100}\/blob\/[A-Za-z0-9_.][A-Za-z0-9_.+@-]*\/(?!(?:[\s\S]*\/)?\.\.?(?:\/|$))[A-Za-z0-9._/-]+$/,
  'must be a GitHub file address: https://github.com/<owner>/<repository>/blob/<ref>/<path>',
);
const githubRepository = checked(githubUrlProblem);
const httpsUrl = checked((value) => sourceUrlProblem(value, ['https']));
const envName = matching(/^[A-Z][A-Z0-9_]*$/, 'must be upper snake case, such as AGENT_KNOWLEDGE');
const fieldValue = either('a text, true or false, a whole number or a list of texts', text, flag, whole(0), list(text));
const fieldValues = map(fieldValue);

// ---- knowledge-provider/v1 --------------------------------------------------------------------------------------

const knowledgeProviderV1 = object({
  schema: schemaKey,
  slot: required(idShape),
  repository: required(githubRepository),
  locations: required(object({ content: required(path) })),
  index: required(path),
  exports: required(list(path, 1)),
  'self-contained': optional(flag),
  citations: optional(
    list(
      object({
        file: required(path),
        text: required(checked(agentHomeCitationProblem)),
        target: required(githubFileUrl),
      }),
    ),
  ),
});

// ---- company-kb/v1 ------------------------------------------------------------------------------------------------

const companyKbV1 = object({
  schema: schemaKey,
  slot: required(idShape),
  layout: required(choice('flat', 'grouped')),
  companies: required(path),
  schemas: required(path),
  provider: required(object({ slot: required(idShape), contract: required(contractName) })),
  check: optional(object({ 'provider-env': optional(envName), 'provider-argument': optional(flag) })),
});

// ---- rendered-copy/v1 ---------------------------------------------------------------------------------------------

const renderedCopyPath = checked((value) => {
  const problem = relativePathProblem(value);
  if (problem !== undefined) return problem;
  return /^generated\/[a-z0-9][a-z0-9-]{0,63}\/[\s\S]+$/.test(value)
    ? undefined
    : 'must be generated/<component>/<path of the source file>';
});
const absoluteHomePath = matching(
  /^(?:\/|[A-Za-z]:\\)[\s\S]+$/,
  'must be an absolute path with the system separators: /Users/v/... or C:\\Users\\v\\...',
);
// RC-7, A-20: a relative target with / separators, spaces encoded, and no drive, scheme or backslash.
// NUL is listed on purpose: a target with a control character is never a path (M-03).
const relativeTarget = matching(
  // eslint-disable-next-line no-control-regex
  /^(?!\/)(?![\s\S]*[\\:\s\u0000])[\s\S]+$/,
  'must be a relative path with / separators and spaces written as %20',
);

const renderedCopyV1 = object({
  schema: schemaKey,
  system: required(choice('mac', 'linux', 'windows')),
  copy: required(renderedCopyPath),
  'first-line': required(choice('Generated from `<source path>`; edit that file, not this copy.')),
  mode: required(choice('read-only')),
  index: required(choice('{{AGENT_HOME}}/generated/index.md')),
  refresh: required(
    object({
      on: required(list(choice('install', 'install --update', 'session-start'), 1)),
      'session-start': required(
        object({
          'only-changed': required(flag),
          'time-limit-seconds': required(whole(1)),
          network: required(choice('none')),
          'on-failure': required(choice('keep-previous-print-one-line-exit-0')),
        }),
      ),
    }),
  ),
  citations: required(list(object({ text: required(absoluteHomePath), target: required(relativeTarget) }), 1)),
});

// ---- skill-source/v1, agent-source/v1 -----------------------------------------------------------------------------

const skillTargets = ['claude', 'agents'];
const agentTargets = ['claude', 'copilot', 'codex'];

/** A mapping whose keys are the build targets of the source; the overlay of each is a table of field values.
 *
 * @param targets - the build targets the source names
 * @returns the shape of the `platforms` key
 */
function overlays(targets: readonly string[]): ReturnType<typeof map> {
  return map(fieldValues, (key) => (targets.includes(key) ? undefined : `must be one of: ${targets.join(', ')}`));
}

const skillSourceV1 = object({
  schema: schemaKey,
  name: required(idShape),
  description: required(text),
  targets: required(list(choice(...skillTargets), 1)),
  metadata: optional(map(text)),
  fields: optional(fieldValues),
  platforms: optional(overlays(skillTargets)),
  includes: optional(flag),
});

const agentSourceV1 = object({
  schema: schemaKey,
  name: required(idShape),
  description: required(text),
  'model-tier': required(idShape),
  'auto-delegate': required(flag),
  'needs-project-instructions': optional(flag),
  preload: optional(list(idShape)),
  tools: optional(object({ intent: required(list(choice('read', 'search', 'edit', 'shell'))) })),
  targets: required(list(choice(...agentTargets), 1)),
  platforms: optional(overlays(agentTargets)),
});

// ---- adapter-fields/v1 --------------------------------------------------------------------------------------------

const homeFolder = matching(
  /^~\/[A-Za-z0-9._-][A-Za-z0-9._/-]*$/,
  'must start with ~/ and name a folder below the home folder',
);
const hookEvents = ['session-start', 'pre-tool', 'prompt-submit', 'stop'];

const adapterField = object({
  name: required(idShape),
  'applies-to': required(choice('agent', 'skill')),
  from: required(fieldValues),
  source: required(httpsUrl),
  verified: required(matching(/^\d{4}-\d{2}-\d{2}$/, 'must be a date written YYYY-MM-DD')),
  enforced: optional(flag),
});

const adapterFieldsV1 = object({
  schema: schemaKey,
  adapter: required(idShape),
  version: required(whole(1)),
  targets: required(
    map(
      object({ folder: required(homeFolder), file: required(text), link: required(choice('per-entry', 'whole')) }),
      (key) => (['agents', 'skills'].includes(key) ? undefined : 'must be one of: agents, skills'),
    ),
  ),
  fields: required(list(adapterField)),
  events: optional(
    map(text, (key) => (hookEvents.includes(key) ? undefined : `must be one of: ${hookEvents.join(', ')}`)),
  ),
});

/** The content contracts by name, each with its file format and its shape per readable major. */
export const contentContracts: Readonly<Record<string, ContractDefinition>> = {
  'knowledge-provider': { format: 'yaml', majors: { 1: knowledgeProviderV1 } },
  'company-kb': { format: 'yaml', majors: { 1: companyKbV1 } },
  'rendered-copy': { format: 'yaml', majors: { 1: renderedCopyV1 } },
  'skill-source': { format: 'yaml', majors: { 1: skillSourceV1 } },
  'agent-source': { format: 'yaml', majors: { 1: agentSourceV1 } },
  'adapter-fields': { format: 'yaml', majors: { 1: adapterFieldsV1 } },
};
