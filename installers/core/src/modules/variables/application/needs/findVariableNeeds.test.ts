// VR-6, AC-6.4, DR-414, M-18: needs and proposals, with a probe double that records what it was asked.
import { describe, expect, it } from 'vitest';
import type { ComponentName } from '#shared/domain/name/NameRules.ts';
import { findVariableNeeds } from '#variables/application/needs/findVariableNeeds.ts';
import type { DetectProbe } from '#variables/application/ports/DetectProbe.ts';
import type { DeclaredVariable } from '#variables/domain/declaration/DeclaredVariables.ts';
import type { DetectRule } from '#variables/domain/declaration/DetectRule.ts';
import type { VariableValues } from '#variables/domain/file/ValuesFile.ts';
import type { VariableName } from '#variables/domain/name/VariableName.ts';

const variable = (name: string, extra: Partial<DeclaredVariable> = {}): DeclaredVariable => ({
  name: name as VariableName,
  description: `Description of ${name}`,
  required: true,
  detect: undefined,
  declaredBy: ['vars' as ComponentName],
  ...extra,
});

function probeOf(folders: string[], environment: Record<string, string> = {}): DetectProbe & { asked: string[] } {
  const asked: string[] = [];
  return {
    asked,
    environmentValue: (name) => environment[name],
    directoryExists: (absolutePath) => {
      asked.push(absolutePath);
      return Promise.resolve(folders.includes(absolutePath));
    },
  };
}

const run = (
  declared: DeclaredVariable[],
  probe: DetectProbe,
  values: VariableValues = new Map(),
  legacyText?: string,
) => findVariableNeeds({ declared, values, probe, userHome: '/home/v', flavor: 'posix', legacyText });

const dir = (...candidates: string[]): DetectRule => ({ kind: 'dir-exists', candidates });

describe('VR-6 which variables are needs', () => {
  it('lists a required variable with no value, in declaration order, and skips the rest', async () => {
    const declared = [variable('B_ONE'), variable('A_TWO'), variable('C_OPT', { required: false }), variable('D_SET')];
    const values = new Map([['D_SET', 'x']]) as unknown as VariableValues;
    const needs = await run(declared, probeOf([]), values);
    expect(needs.map((need) => need.name)).toEqual(['B_ONE', 'A_TWO']);
    expect(needs[0]).toMatchObject({ description: 'Description of B_ONE', declaredBy: ['vars'], proposal: undefined });
  });
});

describe('AC-6.4 detect gives a proposal and nothing else', () => {
  it('proposes the first existing folder as written', async () => {
    const probe = probeOf(['/home/v/ws/ref']);
    const needs = await run([variable('REF_ROOT', { detect: dir('~/nope', '~/ws/ref', '~/later') })], probe);
    expect(needs[0]?.proposal).toBe('~/ws/ref');
    expect(probe.asked).toEqual(['/home/v/nope', '/home/v/ws/ref']);
  });

  it('gives no proposal when nothing is found', async () => {
    const needs = await run([variable('REF_ROOT', { detect: dir('~/ws/ref') })], probeOf([]));
    expect(needs[0]?.proposal).toBeUndefined();
  });

  it('does not probe a variable that already has a value', async () => {
    const probe = probeOf(['/home/v/ws/ref']);
    const values = new Map([['REF_ROOT', '/x']]) as unknown as VariableValues;
    await run([variable('REF_ROOT', { detect: dir('~/ws/ref') })], probe, values);
    expect(probe.asked).toEqual([]);
  });

  it('M-03 never probes a candidate that leaves the home', async () => {
    const probe = probeOf(['/etc']);
    const needs = await run([variable('X', { detect: dir('~/../../etc') })], probe);
    expect(probe.asked).toEqual([]);
    expect(needs[0]?.proposal).toBeUndefined();
  });

  it('proposes the value of an environment variable', async () => {
    const needs = await run(
      [variable('EDITOR', { detect: { kind: 'env', name: 'EDITOR' } })],
      probeOf([], { EDITOR: 'vim' }),
    );
    expect(needs[0]?.proposal).toBe('vim');
  });

  it('M-08 never reads an environment variable of another name than the variable', async () => {
    const probe = probeOf([], { GH_PAT: 'value' });
    const needs = await run([variable('LANGUAGE', { detect: { kind: 'env', name: 'GH_PAT' } })], probe);
    expect(needs[0]?.proposal).toBeUndefined();
  });

  it.each([
    ['a token prefix', 'ghp_abc'],
    ['a URL with a password', 'https://u:p@h/'],
    ['a line break', 'a\nb'],
    ['an empty value', ''],
  ])('M-08 never proposes an environment value with %s', async (_title, value) => {
    const needs = await run(
      [variable('EDITOR', { detect: { kind: 'env', name: 'EDITOR' } })],
      probeOf([], { EDITOR: value }),
    );
    expect(needs[0]?.proposal).toBeUndefined();
  });
});

describe('DR-414 the old variables file', () => {
  const legacy = '| `{{AGENT_CONFIG_REPO}}` | `<SETUP REQUIRED>` | n |\n| `{{LANGUAGE}}` | English | n |';

  it('proposes a usable old value and not a placeholder', async () => {
    const needs = await run([variable('AGENT_CONFIG_REPO'), variable('LANGUAGE')], probeOf([]), new Map(), legacy);
    expect(needs.map((need) => need.proposal)).toEqual([undefined, 'English']);
  });

  it('prefers a detected value to an old one', async () => {
    const needs = await run(
      [variable('LANGUAGE', { detect: dir('~/ws') })],
      probeOf(['/home/v/ws']),
      new Map(),
      legacy,
    );
    expect(needs[0]?.proposal).toBe('~/ws');
  });
});
