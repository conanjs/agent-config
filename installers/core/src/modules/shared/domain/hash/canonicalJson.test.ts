// M-01: the text the approved privileged set is hashed over. Equal values, equal text; unequal values, unequal text; no guessing.
import { describe, expect, it } from 'vitest';
import { canonicalJson } from '#shared/domain/hash/canonicalJson.ts';
import { sha256Hex } from '#shared/domain/hash/sha256Hex.ts';

describe('M-01 canonicalJson writes', () => {
  it.each<[title: string, value: unknown, text: string]>([
    ['sorted keys', { b: 1, a: 2 }, '{"a":2,"b":1}'],
    ['sorted keys at every depth', { z: { y: 1, x: [{ d: 1, c: 2 }] } }, '{"z":{"x":[{"c":2,"d":1}],"y":1}}'],
    ['an array in its order', [3, 1, 2], '[3,1,2]'],
    ['scalars', [null, true, false, 0, 1.5, -2, 'x'], '[null,true,false,0,1.5,-2,"x"]'],
    ['a string with quotes, a backslash and a line feed, escaped', 'a"b\\c\nd', '"a\\"b\\\\c\\nd"'],
    ['a key with a comma, a colon and a quote, escaped', { 'a",":"b': 1 }, '{"a\\",\\":\\"b":1}'],
    ['non-ASCII text as it is', { é: '東' }, '{"é":"東"}'],
    ['an empty object and array', { a: {}, b: [] }, '{"a":{},"b":[]}'],
    ['an object without a prototype', Object.assign(Object.create(null) as object, { b: 1, a: 2 }), '{"a":2,"b":1}'],
  ])('%s', (_title, value, text) => {
    expect(canonicalJson(value)).toBe(text);
  });

  it('gives the same text for the same data written in another key order', () => {
    expect(canonicalJson({ id: 'a', agents: ['x'], event: 'pre' })).toBe(
      canonicalJson({ event: 'pre', id: 'a', agents: ['x'] }),
    );
  });

  it('keeps two different lists apart where a separator join would not', () => {
    expect(canonicalJson(['a,b'])).not.toBe(canonicalJson(['a', 'b']));
    expect(canonicalJson(['a\u0000b'])).not.toBe(canonicalJson(['a', 'b']));
    expect(sha256Hex(canonicalJson({ k: 'a' }))).not.toBe(sha256Hex(canonicalJson({ k: 'b' })));
  });
});

// An array with a hole at `index`, built by assigning every other slot because a literal with a gap is refused by lint (no-sparse-arrays).
function withHole(values: unknown[], index: number): unknown[] {
  const holey = new Array<unknown>(values.length);
  values.forEach((value, position) => {
    if (position !== index) holey[position] = value;
  });
  return holey;
}

describe('M-01 canonicalJson refuses', () => {
  const cycle: Record<string, unknown> = {};
  cycle['self'] = cycle;
  it.each<[title: string, value: unknown]>([
    ['a lone high surrogate', 'a\ud800'],
    ['a lone low surrogate', 'a\udc00'],
    ['a lone surrogate in a key', { 'a\ud800': 1 }],
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['minus Infinity', Number.NEGATIVE_INFINITY],
    ['minus zero', -0],
    ['undefined', undefined],
    ['undefined inside an object', { a: undefined }],
    ['a function', () => 1],
    ['a symbol', Symbol('x')],
    ['a bigint', 1n],
    ['a Date', new Date(0)],
    ['a Map', new Map()],
    ['a sparse array', withHole([1, 2, 3], 1)],
    ['an array with only a hole', new Array<unknown>(1)],
    ['a sparse array inside an object', { a: withHole([0, 1], 0) }],
    ['a value that contains itself', cycle],
  ])('%s', (_title, value) => {
    expect(() => canonicalJson(value)).toThrow();
  });
});
