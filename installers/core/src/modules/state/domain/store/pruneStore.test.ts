// DR-202: the store keeps the current and the previous tree of each component and nothing it does not recognise is deleted.
import { describe, expect, it } from 'vitest';
import { treesToPrune } from '#state/domain/store/pruneStore.ts';

const tree = (folder: string, modifiedMs: number) => ({ folder, modifiedMs });

describe('store pruning', () => {
  it.each([
    [
      'current and previous are kept',
      [tree('core@aaaaaaaaaaaa', 1), tree('core@bbbbbbbbbbbb', 2)],
      { core: 'bbbbbbbbbbbb' },
      [],
    ],
    [
      'the oldest of three goes',
      [tree('core@aaaaaaaaaaaa', 1), tree('core@bbbbbbbbbbbb', 2), tree('core@cccccccccccc', 3)],
      { core: 'cccccccccccc' },
      ['core@aaaaaaaaaaaa'],
    ],
    [
      'the previous is the newest of the others, not the second letter',
      [tree('core@aaaaaaaaaaaa', 9), tree('core@bbbbbbbbbbbb', 1), tree('core@cccccccccccc', 5)],
      { core: 'cccccccccccc' },
      ['core@bbbbbbbbbbbb'],
    ],
    [
      'the current tree is kept even when it is the oldest',
      [tree('core@aaaaaaaaaaaa', 1), tree('core@bbbbbbbbbbbb', 2), tree('core@cccccccccccc', 3)],
      { core: 'aaaaaaaaaaaa' },
      ['core@bbbbbbbbbbbb'],
    ],
    [
      'each component is judged apart',
      [tree('a@111111111111', 1), tree('a@222222222222', 2), tree('b@333333333333', 1)],
      { a: '222222222222', b: '333333333333' },
      [],
    ],
    [
      'a component that left the lists keeps its newest tree',
      [tree('gone@111111111111', 1), tree('gone@222222222222', 2), tree('gone@333333333333', 3)],
      {},
      ['gone@111111111111', 'gone@222222222222'],
    ],
    [
      'equal times are broken by name, so the answer does not depend on the order listed',
      [tree('core@bbbbbbbbbbbb', 5), tree('core@aaaaaaaaaaaa', 5), tree('core@cccccccccccc', 9)],
      { core: 'cccccccccccc' },
      ['core@bbbbbbbbbbbb'],
    ],
    ['nothing in the store', [], { core: 'aaaaaaaaaaaa' }, []],
  ])('%s', (_title, trees, current, expected) => {
    expect(treesToPrune(trees, current)).toEqual(expected);
  });

  it.each([
    'notes.txt',
    'core',
    'core@short',
    'core@AAAAAAAAAAAA',
    '../core@aaaaaaaaaaaa',
    'Core@aaaaaaaaaaaa',
    'core@aaaaaaaaaaaa.bak',
  ])('never picks the name %j, which is not a tree', (folder) => {
    expect(
      treesToPrune(
        [tree(folder, 1), tree('core@111111111111', 2), tree('core@222222222222', 3), tree('core@333333333333', 4)],
        { core: '333333333333' },
      ),
    ).not.toContain(folder);
  });
});
