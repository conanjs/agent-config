// The shape of the tooling contracts the reader knows (specs/022): routes, build, repo-layout, hooks, variables and framework (T065, T069 to T073).
// contract-registry.ts joins this table with the core and the other one; shared parts come from contract-shapes.ts.
import { type ContractDefinition, hook, path, route, schemaKey, variable } from './contract-shapes.ts';
import { idShape, shapes } from './shape.ts';
import { idProblem } from './value-problems.ts';

const { text, matching, choice, list, map, object, tagged, whole, required, optional } = shapes;

// ---- routes/v1, hooks/v1, variables/v1: the entries of a component.yaml, written as a document of their own ------

const routesV1 = object({ schema: schemaKey, routes: required(list(route, 1)) });
const hooksV1 = object({ schema: schemaKey, hooks: required(list(hook, 1)) });
const variablesV1 = object({ schema: schemaKey, variables: required(list(variable, 1)) });

// ---- build/v1: the baseline file that `budget --baseline` writes (AC-1.7) ------------------------------------------

const nonEmpty = matching(/\S/, 'must not be empty');

const agentRecord = {
  characters: required(whole(0)),
  // Named as an estimate on purpose: the number is a rule of thumb, not a count by the agent's own tokenizer (AC-1.7).
  tokens_estimate: required(whole(0)),
  agent_home_lines: required(whole(0)),
  method: required(nonEmpty),
  tool_version: required(nonEmpty),
  node_version: required(matching(/^\d+\.\d+\.\d+$/, 'must be a version such as 24.12.0')),
  date: required(matching(/^\d{4}-\d{2}-\d{2}$/, 'must be a date such as 2026-11-14')),
  commit: required(matching(/^[0-9a-f]{40}$/, 'must be 40 lowercase hexadecimal characters')),
};

// Only Claude Code lists skills by name and description at session start, so only it has the skill list figures.
const claudeCodeRecord = object({
  ...agentRecord,
  skill_list_characters: required(whole(0)),
  skill_list_sdlc_characters: required(whole(0)),
});

const baselineV1 = object({
  schema: schemaKey,
  agents: required(
    object({
      'claude-code': required(claudeCodeRecord),
      'copilot-cli': required(object(agentRecord)),
      codex: required(object(agentRecord)),
    }),
  ),
});

// ---- repo-layout/v1 (FR-012, AC-16.10) -----------------------------------------------------------------------------

const forbiddenRule = tagged('rule', {
  'generated-from-line': object({ rule: required(text), message: required(text) }),
  'build-output-folder': object({
    rule: required(text),
    message: required(text),
    folders: required(list(path, 1)),
  }),
});

const layoutException = object({ entry: required(path), 'stand-in': required(path) });

const repoLayoutV1 = object({
  schema: schemaKey,
  required: required(list(path, 1)),
  'required-if-content': optional(list(path)),
  'missing-message': required(text),
  forbidden: required(list(forbiddenRule, 1)),
  exceptions: optional(map(list(layoutException), idProblem)),
});

// ---- framework/v1 (AC-1.4, AC-14.1 to AC-14.4) ---------------------------------------------------------------------

const frameworkValidator = object({
  id: required(idShape),
  command: required(text),
  arguments: optional(list(idShape)),
});

// What the framework's component.yaml already says (index, skills, agents, routes) is read from there, not repeated here.
const frameworkV1 = object({
  schema: schemaKey,
  'project-links': optional(list(choice('.claude', '.agents'), 1)),
  validators: optional(list(frameworkValidator)),
});

/** The tooling contracts by name, each with its file format and its shape per readable major. */
export const toolingContracts: Readonly<Record<string, ContractDefinition>> = {
  routes: { format: 'yaml', majors: { 1: routesV1 } },
  hooks: { format: 'yaml', majors: { 1: hooksV1 } },
  variables: { format: 'yaml', majors: { 1: variablesV1 } },
  build: { format: 'json', majors: { 1: baselineV1 } },
  'repo-layout': { format: 'yaml', majors: { 1: repoLayoutV1 } },
  framework: { format: 'yaml', majors: { 1: frameworkV1 } },
};
