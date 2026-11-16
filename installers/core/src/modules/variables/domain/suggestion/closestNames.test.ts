// AC-6.3, MG-36: distance 3 or less, nearest first, ties alphabetical, at most three.
import { describe, expect, it } from 'vitest';
import { closestNames } from '#variables/domain/suggestion/closestNames.ts';

describe('AC-6.3 closest declared names', () => {
  it.each([
    ['one swap', 'LANGAUGE', ['LANGUAGE', 'OTHER_THING'], ['LANGUAGE']],
    ['lower case is folded', 'language', ['LANGUAGE'], ['LANGUAGE']],
    ['nothing close', 'ZZZZZZZZZZ', ['LANGUAGE', 'ALPHA_ROOT'], []],
    ['no declared names', 'LANGUAGE', [], []],
    ['distance 3 is kept', 'ABCDEF', ['ABCXYZ'], ['ABCXYZ']],
    ['distance 4 is dropped', 'ABCDEF', ['ABWXYZ'], []],
    ['nearest first, although it sorts last alphabetically', 'BB', ['AA', 'BC'], ['BC', 'AA']],
    ['nearest first among three', 'ROOT_A', ['ROOT_ABC', 'ROOT_AB', 'ROOT_A1'], ['ROOT_A1', 'ROOT_AB', 'ROOT_ABC']],
    ['ties alphabetical', 'AB', ['AD', 'AC', 'AE'], ['AC', 'AD', 'AE']],
    ['at most three', 'AB', ['AC', 'AD', 'AE', 'AF'], ['AC', 'AD', 'AE']],
    ['repeats count once', 'AB', ['AC', 'AC', 'AD'], ['AC', 'AD']],
    ['input order does not matter', 'AB', ['AE', 'AC', 'AD'], ['AC', 'AD', 'AE']],
  ])('%s', (_title, typed, declared, expected) => {
    expect(closestNames(typed, declared)).toEqual(expected);
  });

  it('a typed name over 128 characters finds nothing and is cheap', () => {
    expect(closestNames('A'.repeat(100_000), ['A'.repeat(100_000)])).toEqual([]);
  });

  it('a hostile list of many names stays fast', () => {
    const many = Array.from({ length: 20_000 }, (_unused, index) => `NAME_${index}`);
    const start = performance.now();
    closestNames('NAME_7', many);
    expect(performance.now() - start).toBeLessThan(2000);
  });
});
