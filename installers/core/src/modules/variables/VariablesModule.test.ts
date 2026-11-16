// MOD-11: the composer fills the ports in; one run through all four use cases proves the wiring.
import { describe, expect, it } from 'vitest';
import type { ComponentName } from '#shared/domain/name/NameRules.ts';
import { composeVariables } from '#variables/VariablesModule.ts';
import type { VariableName } from '#variables/domain/name/VariableName.ts';

const api = composeVariables({
  store: {
    readText: () =>
      Promise.resolve({ ok: true, value: '{"schema":"variables-local/v1","values":{"LANGUAGE":"English"}}' }),
  },
  readYaml: (text) => ({ ok: true, value: JSON.parse(text) as unknown }),
  detectProbe: {
    environmentValue: () => undefined,
    directoryExists: (folder) => Promise.resolve(folder === '/home/v/ws'),
  },
  pathProbe: {
    realPath: (path) => ({ kind: 'real', path }),
    isLink: () => 'not-link',
    identity: (path) =>
      path === '/home/v' || path === '/home' || path === '/'
        ? { kind: 'identity', dev: 1n, ino: BigInt(path.length) }
        : { kind: 'missing' },
  },
  userHome: '/home/v',
  flavor: 'posix',
});

const declared = [
  {
    name: 'LANGUAGE' as VariableName,
    description: 'd',
    required: false,
    detect: undefined,
    declaredBy: ['c' as ComponentName],
  },
  {
    name: 'WS' as VariableName,
    description: 'd',
    required: true,
    detect: { kind: 'dir-exists', candidates: ['~/ws'] } as const,
    declaredBy: ['c' as ComponentName],
  },
];

describe('the variables composer', () => {
  it('loads values through the store and the YAML reader', async () => {
    expect(await api.loadValues()).toEqual({ ok: true, value: new Map([['LANGUAGE', 'English']]) });
  });

  it('finds needs through the detect probe', async () => {
    const needs = await api.findNeeds({ declared, values: new Map(), legacyText: undefined });
    expect(needs.map((need) => [need.name, need.proposal])).toEqual([['WS', '~/ws']]);
  });

  it('plans a set', () => {
    expect(api.planSet({ argument: 'LANGUAGE=Vietnamese', declared, current: new Map() }).ok).toBe(true);
  });

  it('verifies a home by identity and refuses the user home', () => {
    const choice = { path: '/home/v', source: 'AGENT_CONFIG_HOME', confirmed: false, recordedHome: undefined } as const;
    expect(api.verifyHome(choice).ok).toBe(false);
  });
});
