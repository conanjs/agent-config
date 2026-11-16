// AC-6.1, AC-6.3, M-08, VR-3, VR-4: every `set` outcome of tests/installer-variables/variables.feature, as a table.
import { describe, expect, it } from 'vitest';
import type { ComponentName } from '#shared/domain/name/NameRules.ts';
import { planSetVariable } from '#variables/application/set/planSetVariable.ts';
import type { DeclaredVariable } from '#variables/domain/declaration/DeclaredVariables.ts';
import type { VariableValues } from '#variables/domain/file/ValuesFile.ts';
import type { VariableName } from '#variables/domain/name/VariableName.ts';

const declare = (name: string): DeclaredVariable => ({
  name: name as VariableName,
  description: 'd',
  required: false,
  detect: undefined,
  declaredBy: ['c' as ComponentName],
});
const declared = ['LANGUAGE', 'ALPHA_ROOT', 'BETA_NAME', 'GAMMA_DIR'].map(declare);
const none: VariableValues = new Map();

describe('AC-6.1 an accepted set', () => {
  it('writes the exact file of the scenario', () => {
    const result = planSetVariable({ argument: 'LANGUAGE=English', declared, current: none });
    expect(result).toEqual({
      ok: true,
      value: {
        name: 'LANGUAGE',
        fileText: 'schema: variables-local/v1\nvalues:\n  LANGUAGE: English\n',
        changed: true,
      },
    });
  });

  it('M-10 replaces a value and keeps the others', () => {
    const current = new Map([
      ['LANGUAGE', 'Vietnamese'],
      ['OLD_GONE', 'kept'],
    ]) as unknown as VariableValues;
    const result = planSetVariable({ argument: 'LANGUAGE=English', declared, current });
    expect(result.ok && result.value.fileText).toBe(
      'schema: variables-local/v1\nvalues:\n  LANGUAGE: English\n  OLD_GONE: kept\n',
    );
  });

  it('reports a value that did not change', () => {
    const current = new Map([['LANGUAGE', 'English']]) as unknown as VariableValues;
    expect(planSetVariable({ argument: 'LANGUAGE=English', declared, current })).toMatchObject({
      ok: true,
      value: { changed: false },
    });
  });

  it('keeps an = inside the value', () => {
    const result = planSetVariable({ argument: 'LANGUAGE=a=b', declared, current: none });
    expect(result.ok && result.value.fileText).toContain('LANGUAGE: "a=b"');
  });
});

describe('M-08 refused names, declared or not, before the declared check', () => {
  it.each([
    ['GITHUB_TOKEN', 'TOKEN'],
    ['CLIENT_SECRET', 'SECRET'],
    ['DB_PASSWORD', 'PASSWORD'],
    ['MY_APIKEY', 'APIKEY'],
    ['MY_API_KEY', 'API_KEY'],
  ])('refuses %s for %s', (name, word) => {
    expect(planSetVariable({ argument: `${name}=anything`, declared, current: none })).toEqual({
      ok: false,
      error: { kind: 'secret-name', name, word },
    });
  });

  it('refuses a secret-like name even when a component declares it', () => {
    const result = planSetVariable({ argument: 'MY_TOKEN=x', declared: [declare('MY_TOKEN')], current: none });
    expect(result.ok === false && result.error.kind).toBe('secret-name');
  });
});

describe('M-08 refused values, never printed', () => {
  it.each(['ghp_', 'github_pat_', 'sk-', 'AKIA', 'xox'])('refuses a value that starts with %s', (prefix) => {
    const result = planSetVariable({ argument: `LANGUAGE=${prefix}0000FAKE`, declared, current: none });
    expect(result).toEqual({ ok: false, error: { kind: 'secret-value', name: 'LANGUAGE', prefix } });
    expect(JSON.stringify(result)).not.toContain('0000FAKE');
  });

  it('checks the secret value before the declared name', () => {
    const result = planSetVariable({ argument: 'NOT_DECLARED=ghp_x', declared, current: none });
    expect(result.ok === false && result.error.kind).toBe('secret-value');
  });

  it('checks the secret name before the secret value', () => {
    const result = planSetVariable({ argument: 'MY_TOKEN=ghp_x', declared, current: none });
    expect(result.ok === false && result.error.kind).toBe('secret-name');
  });

  it.each([
    ['empty', 'LANGUAGE=', 'empty'],
    ['a line break', 'LANGUAGE=a\nb', 'unsafe-characters'],
    ['an escape sequence', 'LANGUAGE=\u001b[2J', 'unsafe-characters'],
    ['a URL with a password', 'LANGUAGE=https://u:hunter2@h/', 'credential-like'],
    ['too long', `LANGUAGE=${'x'.repeat(2000)}`, 'too-long'],
  ])('refuses %s as invalid-value', (_title, argument, kind) => {
    const result = planSetVariable({ argument, declared, current: none });
    expect(result.ok === false && result.error.kind === 'invalid-value' && result.error.violation.kind).toBe(kind);
    expect(JSON.stringify(result)).not.toContain('hunter2');
  });
});

describe('AC-6.3 an undeclared name', () => {
  it('lists the closest declared names', () => {
    expect(planSetVariable({ argument: 'LANGAUGE=English', declared, current: none })).toEqual({
      ok: false,
      error: { kind: 'undeclared', name: 'LANGAUGE', closest: ['LANGUAGE'] },
    });
  });

  it('refuses a name no enabled component declares, with no suggestion when none is close', () => {
    const result = planSetVariable({ argument: 'OFF_ONLY=x', declared: declared.slice(0, 1), current: none });
    expect(result).toEqual({ ok: false, error: { kind: 'undeclared', name: 'OFF_ONLY', closest: [] } });
  });

  it('refuses AGENT_HOME, which is computed', () => {
    const result = planSetVariable({ argument: 'AGENT_HOME=/x', declared, current: none });
    expect(result.ok === false && result.error.kind).toBe('undeclared');
  });

  it('cuts a hostile name to 128 characters', () => {
    const result = planSetVariable({ argument: `${'A'.repeat(5000)}=x`, declared, current: none });
    expect(result.ok === false && result.error.kind === 'undeclared' && result.error.name.length).toBeLessThan(140);
  });
});

describe('usage', () => {
  it.each([
    ['LANGUAGE', 'no-equals-sign'],
    ['=English', 'no-name'],
  ])('answers %j with %s', (argument, reason) => {
    expect(planSetVariable({ argument, declared, current: none })).toEqual({
      ok: false,
      error: { kind: 'usage', reason },
    });
  });
});
