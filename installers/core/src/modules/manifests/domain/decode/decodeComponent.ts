import {
  asFlag,
  asList,
  asMapping,
  asNumberMap,
  asOptionalText,
  asText,
  asTextList,
  asTextMap,
  type Mapping,
} from '#manifests/domain/decode/Fields.ts';
import type {
  ComponentManifest,
  DetectRule,
  HookEntry,
  RouteEntry,
  ServiceEntry,
  SlotDependency,
  SuggestedSource,
  VariableDeclaration,
} from '#manifests/domain/model/Component.ts';

function decodeService(value: unknown): ServiceEntry {
  const service = asMapping(value);
  return {
    kind: asText(service['kind']),
    name: asText(service['name']),
    command: asText(service['command']),
    args: asTextList(service['args']),
  };
}

function decodeRoute(value: unknown): RouteEntry {
  const route = asMapping(value);
  return {
    id: asText(route['id']),
    when: asText(route['when']),
    read: asText(route['read']),
    beforeWriting: asOptionalText(route['before-writing']),
  };
}

function decodeHook(value: unknown): HookEntry {
  const hook = asMapping(value);
  const matcher = hook['matcher'];
  return {
    id: asText(hook['id']),
    event: asText(hook['event']),
    agents: asTextList(hook['agents']),
    command: asText(hook['command']),
    matcher: matcher === null ? null : asOptionalText(matcher),
  };
}

function decodeDetect(value: unknown): DetectRule | undefined {
  const detect = asMapping(value);
  if (detect['kind'] === 'env') return { kind: 'env', name: asText(detect['name']) };
  if (detect['kind'] === 'dir-exists') return { kind: 'dir-exists', candidates: asTextList(detect['candidates']) };
  return undefined;
}

function decodeVariable(value: unknown): VariableDeclaration {
  const variable = asMapping(value);
  return {
    name: asText(variable['name']),
    description: asText(variable['description']),
    required: asFlag(variable['required'], false),
    detect: decodeDetect(variable['detect']),
  };
}

function decodeSuggestion(value: unknown): SuggestedSource | undefined {
  const source = asMapping(asMapping(value)['source']);
  if (source['type'] === 'git') return { type: 'git', url: asText(source['url']), ref: asText(source['ref']) };
  if (source['type'] === 'archive') {
    return { type: 'archive', url: asText(source['url']), sha256: asText(source['sha256']) };
  }
  return undefined;
}

function decodeSlotDependency(value: unknown): SlotDependency {
  const dependency = asMapping(value);
  return {
    slot: asText(dependency['slot']),
    contract: asText(dependency['contract']),
    required: asFlag(dependency['required'], false),
    docs: asTextList(dependency['docs']),
    suggest: decodeSuggestion(dependency['suggest']),
  };
}

function decodeScope(value: unknown): 'global' | 'per-project' | undefined {
  return value === 'global' || value === 'per-project' ? value : undefined;
}

/**
 * Turns a component/v1 document that the contract reader accepted into a manifest.
 *
 * Unknown keys are not copied, so nothing a component adds beyond the contract travels any further.
 *
 * @param document - the parsed, checked document
 * @returns the manifest
 */
export function decodeComponent(document: Mapping): ComponentManifest {
  const provides = asMapping(document['provides']);
  const depends = asMapping(document['depends']);
  const pin = asMapping(document['contracts'])['pin'];
  return {
    name: asText(document['name']),
    version: asText(document['version']),
    slot: asText(document['slot']),
    repository: asOptionalText(document['repository']),
    scope: decodeScope(document['scope']),
    contractsPin: typeof pin === 'number' ? pin : 0,
    locations: asTextMap(document['locations']),
    provides: {
      contracts: asTextList(provides['contracts']),
      index: asOptionalText(provides['index']),
      exports: asTextList(provides['exports']),
      skills: asOptionalText(provides['skills']),
      agents: asOptionalText(provides['agents']),
      services: asList(provides['services']).map(decodeService),
    },
    depends: {
      slots: asList(depends['slots']).map(decodeSlotDependency),
      runtime: asTextMap(depends['runtime']),
    },
    routes: asList(document['routes']).map(decodeRoute),
    hooks: asList(document['hooks']).map(decodeHook),
    variables: asList(document['variables']).map(decodeVariable),
    idleCost: asNumberMap(document['idle-cost']),
  };
}
