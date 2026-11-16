// M-08: doctor re-checks the rendered table, so a hand edit after `set` is found.
import { describe, expect, it } from 'vitest';
import { checkPublicVariable } from '#variables/application/doctor/checkPublicVariable.ts';

describe('M-08 doctor re-check of a rendered row', () => {
  it.each([
    ['LANGUAGE', 'English'],
    ['ALPHA_ROOT', '/data/alpha'],
  ])('accepts %s', (name, value) => {
    expect(checkPublicVariable(name, value)).toBeUndefined();
  });

  it.each([
    ['GITHUB_TOKEN', 'x', 'secret-name'],
    ['LANGUAGE', 'ghp_0000', 'value'],
    ['LANGUAGE', 'https://u:p@h/', 'value'],
    ['LANGUAGE', 'a\u202eb', 'value'],
  ])('finds %s = %j', (name, value, kind) => {
    expect(checkPublicVariable(name, value)?.kind).toBe(kind);
  });
});
