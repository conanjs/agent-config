import { describe, expect, it } from 'vitest';
import { parseAssignment } from '#variables/domain/assignment/parseAssignment.ts';

describe('AC-6.1 the set argument', () => {
  it.each([
    ['LANGUAGE=English', 'LANGUAGE', 'English'],
    ['ROOT=/a=b', 'ROOT', '/a=b'],
    ['EMPTY=', 'EMPTY', ''],
    ['SPACED= x ', 'SPACED', ' x '],
  ])('splits %j', (argument, name, value) => {
    expect(parseAssignment(argument)).toEqual({ ok: true, value: { name, value } });
  });

  it.each([
    ['NOEQUALS', 'no-equals-sign'],
    ['', 'no-equals-sign'],
    ['=value', 'no-name'],
  ])('refuses %j as %s', (argument, kind) => {
    expect(parseAssignment(argument)).toEqual({ ok: false, error: { kind } });
  });
});
