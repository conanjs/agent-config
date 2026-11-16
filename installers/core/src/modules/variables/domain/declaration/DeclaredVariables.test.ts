// VR-1, VR-2, M-08, M-18 for declarations: the union of the enabled components, in table order.
import { describe, expect, it } from 'vitest';
import type { ComponentName } from '#shared/domain/name/NameRules.ts';
import { mergeDeclarations, type ComponentVariables } from '#variables/domain/declaration/DeclaredVariables.ts';

const component = (name: string, ...variables: ComponentVariables['variables'][number][]): ComponentVariables => ({
  component: name as ComponentName,
  variables,
});

describe('AC-6.2 the union of declarations', () => {
  it('lists components by name, each in declaration order, one entry per name', () => {
    const result = mergeDeclarations([
      component('vars-b', { name: 'DELTA_HOME', description: 'Home of delta' }),
      component(
        'vars-a',
        { name: 'ALPHA_ROOT', description: 'Folder of alpha files' },
        { name: 'BETA_NAME', description: 'Name of beta' },
        { name: 'GAMMA_DIR', description: 'Folder of gamma files' },
      ),
    ]);
    expect(result.ok && result.value.map((v) => [v.name, v.declaredBy[0]])).toEqual([
      ['ALPHA_ROOT', 'vars-a'],
      ['BETA_NAME', 'vars-a'],
      ['GAMMA_DIR', 'vars-a'],
      ['DELTA_HOME', 'vars-b'],
    ]);
  });

  it('EDGE-10 one description twice gives one entry naming both, required if either says so', () => {
    const result = mergeDeclarations([
      component('notes', { name: 'NOTES_ROOT', description: 'Folder of notes' }),
      component('extras', { name: 'NOTES_ROOT', description: 'Folder of notes', required: true }),
    ]);
    expect(result).toMatchObject({
      ok: true,
      value: [{ name: 'NOTES_ROOT', required: true, declaredBy: ['extras', 'notes'] }],
    });
  });

  it('EDGE-10 two descriptions fail naming both components in name order', () => {
    const result = mergeDeclarations([
      component('notes', { name: 'NOTES_ROOT', description: 'Folder of notes' }),
      component('extras', { name: 'NOTES_ROOT', description: 'Folder with notes' }),
    ]);
    expect(result).toEqual({
      ok: false,
      error: [
        {
          kind: 'description-conflict',
          name: 'NOTES_ROOT',
          first: { component: 'extras', description: 'Folder with notes' },
          second: { component: 'notes', description: 'Folder of notes' },
        },
      ],
    });
  });

  it('takes the first detect rule in component order', () => {
    const result = mergeDeclarations([
      component('b', { name: 'X', description: 'd', detect: { kind: 'dir-exists', candidates: ['~/b'] } }),
      component('a', { name: 'X', description: 'd', detect: { kind: 'dir-exists', candidates: ['~/a'] } }),
    ]);
    expect(result.ok && result.value[0]?.detect).toEqual({ kind: 'dir-exists', candidates: ['~/a'] });
  });

  it('reports every violation, not only the first', () => {
    const result = mergeDeclarations([
      component('a', { name: 'lower', description: 'd' }, { name: 'OK', description: 'one' }),
      component('b', { name: 'OK', description: 'two' }),
    ]);
    expect(result.ok === false && result.error.map((v) => v.kind)).toEqual(['invalid-name', 'description-conflict']);
  });
});

describe('M-08 and M-18 declarations that are refused', () => {
  it.each([
    ['a secret-like name', { name: 'GITHUB_TOKEN', description: 'd' }, 'secret-like-name'],
    ['the computed name', { name: 'AGENT_HOME', description: 'd' }, 'reserved-name'],
    ['a lower case name', { name: 'language', description: 'd' }, 'invalid-name'],
    ['an empty description', { name: 'OK', description: '  ' }, 'invalid-description'],
    [
      'a description with a line break that would add a table row',
      { name: 'OK', description: 'x\n| EVIL | y |' },
      'invalid-description',
    ],
    ['a description with a bidi control', { name: 'OK', description: 'x\u202ey' }, 'invalid-description'],
    ['a description over 300 characters', { name: 'OK', description: 'x'.repeat(301) }, 'invalid-description'],
    [
      'M-18 a detect of kind command',
      { name: 'OK', description: 'd', detect: { kind: 'command', command: 'ls' } },
      'invalid-detect',
    ],
  ])('refuses %s', (_title, declaration, kind) => {
    const result = mergeDeclarations([component('a', declaration)]);
    expect(result.ok === false && result.error[0]?.kind).toBe(kind);
  });

  it('is fast with a hostile number of declarations of one name', () => {
    const many = Array.from({ length: 50_000 }, () => ({ name: 'SAME', description: 'd' }));
    const start = performance.now();
    expect(mergeDeclarations([component('a', ...many)]).ok).toBe(true);
    expect(performance.now() - start).toBeLessThan(2000);
  });
});
