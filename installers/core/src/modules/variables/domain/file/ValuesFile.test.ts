// variables-local/v1: what `set` writes (exact text of AC-6.1) and what a hand-edited file may hold.
import { describe, expect, it } from 'vitest';
import { emitValuesFile, readValuesFile, type VariableValues } from '#variables/domain/file/ValuesFile.ts';
import type { VariableName } from '#variables/domain/name/VariableName.ts';
import type { VariableValue } from '#variables/domain/value/VariableValue.ts';

const values = (entries: Record<string, string>): VariableValues =>
  new Map(Object.entries(entries)) as unknown as VariableValues & Map<VariableName, VariableValue>;

describe('AC-6.1 the file set writes', () => {
  it('has exactly the text of the scenario', () => {
    expect(emitValuesFile(values({ LANGUAGE: 'English' }))).toBe(
      'schema: variables-local/v1\nvalues:\n  LANGUAGE: English\n',
    );
  });

  it('is sorted by name, whatever the insertion order', () => {
    expect(emitValuesFile(values({ B: 'b', A: 'a' }))).toBe('schema: variables-local/v1\nvalues:\n  A: a\n  B: b\n');
  });

  it('writes no values as an empty map', () => {
    expect(emitValuesFile(values({}))).toBe('schema: variables-local/v1\nvalues: {}\n');
  });

  it.each([
    ['/data/alpha', '/data/alpha'],
    ['~/ws/ref', '~/ws/ref'],
    ['Folder of notes', 'Folder of notes'],
    ['yes', '"yes"'],
    ['null', '"null"'],
    ['~', '"~"'],
    ['8080', '"8080"'],
    ['1e3', '"1e3"'],
    ['a: b', '"a: b"'],
    ['a # b', '"a # b"'],
    ['https://example.com/x', '"https://example.com/x"'],
    ['C:\\Users\\v', '"C:\\\\Users\\\\v"'],
    ['say "hi"', '"say \\"hi\\""'],
    ['trailing ', '"trailing "'],
    ['- item', '"- item"'],
    ['{a}', '"{a}"'],
    ['*alias', '"*alias"'],
    ['!tag', '"!tag"'],
    ['&anchor', '"&anchor"'],
    ['\u00c9t\u00e9', '"\u00c9t\u00e9"'],
  ])('writes %j as %s', (value, written) => {
    expect(emitValuesFile(values({ X: value }))).toBe(`schema: variables-local/v1\nvalues:\n  X: ${written}\n`);
  });

  it('quotes a key that a YAML reader would read as another type', () => {
    expect(emitValuesFile(values({ TRUE: 'x' }))).toContain('  "TRUE": x');
  });
});

describe('reading the file', () => {
  it('accepts an empty file, a file with no values and a file with values', () => {
    expect(readValuesFile(null)).toEqual({ ok: true, value: new Map() });
    expect(readValuesFile({ schema: 'variables-local/v1' })).toEqual({ ok: true, value: new Map() });
    expect(readValuesFile({ schema: 'variables-local/v1', values: { A: 'x' } })).toEqual({
      ok: true,
      value: new Map([['A', 'x']]),
    });
  });

  it.each([
    ['another schema', { schema: 'variables-local/v2', values: {} }, 'wrong-schema'],
    ['no schema', { values: {} }, 'wrong-schema'],
    ['a list', ['a'], 'wrong-shape'],
    ['a text', 'x', 'wrong-shape'],
    ['values as a list', { schema: 'variables-local/v1', values: ['a'] }, 'wrong-shape'],
    ['a lower case key', { schema: 'variables-local/v1', values: { language: 'x' } }, 'bad-entry'],
    ['M-08 a secret-like name', { schema: 'variables-local/v1', values: { GITHUB_TOKEN: 'x' } }, 'bad-entry'],
    ['M-08 a secret-like value', { schema: 'variables-local/v1', values: { A: 'ghp_x' } }, 'bad-entry'],
    ['a number', { schema: 'variables-local/v1', values: { A: 8080 } }, 'bad-entry'],
    ['a boolean', { schema: 'variables-local/v1', values: { A: true } }, 'bad-entry'],
    ['a nested map', { schema: 'variables-local/v1', values: { A: { b: 1 } } }, 'bad-entry'],
    ['a value with a line break', { schema: 'variables-local/v1', values: { A: 'a\nb' } }, 'bad-entry'],
  ])('refuses %s', (_title, parsed, kind) => {
    const result = readValuesFile(parsed);
    expect(result.ok === false && result.error.kind).toBe(kind);
  });

  it('M-08 a refusal never repeats the value', () => {
    expect(
      JSON.stringify(readValuesFile({ schema: 'variables-local/v1', values: { A: 'ghp_S3CRETVALUE' } })),
    ).not.toContain('S3CRETVALUE');
  });
});
