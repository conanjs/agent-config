import { describe, expect, it } from 'vitest';
import { parseVersion, satisfiesRange } from '#resolution/domain/runtime/versionRange.ts';

describe('parseVersion', () => {
  it.each([
    ['24.12.0', [24, 12, 0]],
    ['v24.11.0', [24, 11, 0]],
    ['24.12.0-rc.1', [24, 12, 0]],
    ['2.50.1+build', [2, 50, 1]],
    ['  v1.2.3\n', [1, 2, 3]],
  ])('reads %j', (text, triple) => {
    expect(parseVersion(text)).toEqual(triple);
  });
  it.each(['', '24', '24.12', 'abc', 'v24.12.x', '1.2.3.4'])('refuses %j', (text) => {
    expect(parseVersion(text)).toBeUndefined();
  });
});

describe('satisfiesRange', () => {
  it.each([
    ['>=24.12', '24.12.0', true],
    ['>=24.12', 'v24.12.0', true],
    ['>=24.12', '24.11.9', false],
    ['>=24.12', '25.0.0', true],
    ['>=24.12.1', '24.12.0', false],
    ['>=24.12 <25', '24.99.0', true],
    ['>=24.12 <25', '25.0.0', false],
    ['>24', '24.9.0', false],
    ['>24', '25.0.0', true],
    ['>24.11.0', '24.11.0', false],
    ['>24.11.0', '24.11.1', true],
    ['<=24', '24.99.9', true],
    ['<=24', '25.0.0', false],
    ['<24.12', '24.11.9', true],
    ['<24.12', '24.12.0', false],
    ['^24.12', '24.13.0', true],
    ['^24.12', '25.0.0', false],
    ['^0.2.3', '0.2.9', true],
    ['^0.2.3', '0.3.0', false],
    ['~24.12.1', '24.12.9', true],
    ['~24.12.1', '24.13.0', false],
    ['~24', '24.9.0', true],
    ['~24', '25.0.0', false],
    ['24', '24.5.0', true],
    ['24', '25.0.0', false],
    ['=24.12.0', '24.12.0', true],
    ['=24.12.0', '24.12.1', false],
    ['24.12', '24.12.7', true],
    ['24.12', '24.13.0', false],
  ])('range %s with %s is %s', (range, found, expected) => {
    expect(satisfiesRange(range, found)).toBe(expected);
  });

  it.each([
    ['an empty range', '', '24.12.0'],
    ['a range with an unknown operator', '!24.12', '24.12.0'],
    ['a range with alternatives', '>=24 || >=22', '24.12.0'],
    ['words', 'latest', '24.12.0'],
    ['an unreadable found version', '>=24', 'twenty-four'],
    ['a partial found version', '>=24', '24.12'],
  ])('is not met for %s (fail closed)', (_title, range, found) => {
    expect(satisfiesRange(range, found)).toBe(false);
  });
});
