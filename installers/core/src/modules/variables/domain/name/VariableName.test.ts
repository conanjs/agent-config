import { describe, expect, it } from 'vitest';
import { parseVariableName } from '#variables/domain/name/VariableName.ts';

describe('variables/v1 names', () => {
  it.each(['LANGUAGE', 'OTS_REPOS_ROOT', 'A', 'A1_B2', 'X'.repeat(128)])('accepts %j', (name) => {
    expect(parseVariableName(name)).toEqual({ ok: true, value: name });
  });

  it.each([
    ['empty', ''],
    ['lower case', 'language'],
    ['leading digit', '1A'],
    ['leading underscore', '_A'],
    ['hyphen', 'A-B'],
    ['space', 'A B'],
    ['newline', 'A\nB'],
    ['NUL', 'A\0'],
    ['non-ASCII', 'A\u00c9'],
    ['129 characters', 'X'.repeat(129)],
  ])('refuses %s as invalid-name', (_title, name) => {
    const result = parseVariableName(name);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('invalid-name');
  });

  it('refuses AGENT_HOME, which the installer computes', () => {
    const result = parseVariableName('AGENT_HOME');
    expect(result.ok === false && result.error.kind).toBe('reserved-name');
  });

  it('M-08 never repeats a refused name, which may hold a secret', () => {
    expect(JSON.stringify(parseVariableName('tok-S3CRET-value'))).not.toContain('S3CRET');
  });
});
