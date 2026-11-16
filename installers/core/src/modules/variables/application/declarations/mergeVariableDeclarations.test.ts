import { describe, expect, it } from 'vitest';
import {
  AGENT_HOME_TABLE_ROW,
  mergeVariableDeclarations,
} from '#variables/application/declarations/mergeVariableDeclarations.ts';
import type { ComponentName } from '#shared/domain/name/NameRules.ts';

describe('VR-1 the table of variables', () => {
  it('opens with the computed AGENT_HOME row of the scenarios', () => {
    expect(AGENT_HOME_TABLE_ROW).toEqual({
      name: 'AGENT_HOME',
      description: 'Folder of the agent home',
      declaredBy: 'agent-config',
    });
  });

  it('merges an empty set of components into nothing', () => {
    expect(mergeVariableDeclarations([])).toEqual({ ok: true, value: [] });
  });

  it('fails on a declaration of the computed name', () => {
    const result = mergeVariableDeclarations([
      { component: 'a' as ComponentName, variables: [{ name: 'AGENT_HOME', description: 'd' }] },
    ]);
    expect(result.ok === false && result.error[0]?.kind).toBe('reserved-name');
  });
});
