import { describe, expect, it } from 'vitest';
import { findCycles, providersFirst, type Edges } from '#resolution/domain/rules/cycles.ts';

const graph = (table: Record<string, string[]>): Edges => new Map(Object.entries(table));

describe('findCycles', () => {
  it.each([
    ['no edges', {}, []],
    ['a chain', { a: ['b'], b: ['c'], c: [] }, []],
    ['a diamond', { a: ['b', 'c'], b: ['d'], c: ['d'], d: [] }, []],
    ['a self-cycle', { a: ['a'] }, [['a']]],
    ['two nodes', { b: ['a'], a: ['b'] }, [['a', 'b']]],
    ['three nodes starting at the smallest name', { c: ['a'], b: ['c'], a: ['b'] }, [['a', 'b', 'c']]],
    [
      'two separate cycles',
      { a: ['b'], b: ['a'], x: ['y'], y: ['x'] },
      [
        ['a', 'b'],
        ['x', 'y'],
      ],
    ],
    ['a walk that enters the cycle at a name that is not the smallest', { a: ['e'], e: ['b'], b: ['e'] }, [['b', 'e']]],
    ['a cycle behind a chain', { z: ['m'], m: ['n'], n: ['m'] }, [['m', 'n']]],
    ['an edge to a name that is not a node', { a: ['ghost'] }, []],
  ])('%s', (_title, table, expected) => {
    expect(findCycles(graph(table))).toEqual(expected);
  });

  it('finds a cycle at the end of a 20000 name chain without overflowing the stack', () => {
    const table: Record<string, string[]> = {};
    const names = Array.from({ length: 20_000 }, (_v, n) => `n${String(n).padStart(6, '0')}`);
    names.forEach((name, n) => (table[name] = [names[n + 1] ?? names[19_990] ?? name]));
    expect(findCycles(graph(table)).length).toBe(1);
  });
});

describe('providersFirst', () => {
  it.each([
    ['a chain', { a: ['b'], b: ['c'], c: [] }, ['c', 'b', 'a']],
    ['independent names in name order', { b: [], a: [], c: [] }, ['a', 'b', 'c']],
    ['a diamond', { a: ['b', 'c'], b: ['d'], c: ['d'], d: [] }, ['d', 'b', 'c', 'a']],
    ['a self-edge is ignored', { a: ['a'], b: ['a'] }, ['a', 'b']],
  ])('%s', (_title, table, expected) => {
    expect(providersFirst(graph(table))).toEqual(expected);
  });
  it('does not loop on a cycle', () => {
    expect([...providersFirst(graph({ a: ['b'], b: ['a'] }))].sort()).toEqual(['a', 'b']);
  });
});
