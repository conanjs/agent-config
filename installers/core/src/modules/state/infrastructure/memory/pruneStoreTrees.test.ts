// DR-202: pruning on a disk: old trees go with their content, a link inside is removed as a link, and what is not a tree stays.
import { describe, expect, it } from 'vitest';
import { pruneStoreTrees } from '#state/application/store/pruneStoreTrees.ts';
import { createMemoryState } from '#state/infrastructure/memory/MemoryState.ts';

describe('DR-202 pruning the store', () => {
  function store() {
    const machine = createMemoryState();
    for (const [folder, time] of [
      ['core@aaaaaaaaaaaa', 1],
      ['core@bbbbbbbbbbbb', 2],
      ['core@cccccccccccc', 3],
    ] as const) {
      machine.disk.setTime(time);
      machine.disk.seedFile(`/h/.agent-config/store/${folder}/index.md`, folder);
    }
    return machine;
  }

  it('deletes the trees older than the current and the previous', () => {
    const machine = store();
    expect(pruneStoreTrees(machine.ports, { core: 'cccccccccccc' })).toEqual(['core@aaaaaaaaaaaa']);
    expect(machine.disk.listing().filter((line) => line.includes('/store/'))).toEqual([
      '/h/.agent-config/store/core@bbbbbbbbbbbb folder 755',
      '/h/.agent-config/store/core@bbbbbbbbbbbb/index.md file 644 "core@bbbbbbbbbbbb"',
      '/h/.agent-config/store/core@cccccccccccc folder 755',
      '/h/.agent-config/store/core@cccccccccccc/index.md file 644 "core@cccccccccccc"',
    ]);
  });

  it('M-04 removes a link inside a doomed tree as a link, never the folder it points at', () => {
    const machine = store();
    machine.disk.seedFile('/h/V-notes/keep.md', 'keep');
    machine.disk.seedLink('/h/.agent-config/store/core@aaaaaaaaaaaa/notes', '/h/V-notes');
    pruneStoreTrees(machine.ports, { core: 'cccccccccccc' });
    expect(machine.disk.listing()).toContain('/h/V-notes/keep.md file 644 "keep"');
  });

  it('M-04 never deletes a store entry that is a link', () => {
    const machine = store();
    machine.disk.seedFolder('/h/elsewhere');
    machine.disk.seedLink('/h/.agent-config/store/core@dddddddddddd', '/h/elsewhere');
    machine.disk.setTime(0);
    expect(pruneStoreTrees(machine.ports, { core: 'cccccccccccc' })).toEqual(['core@aaaaaaaaaaaa']);
    expect(machine.disk.listing()).toContain('/h/elsewhere folder 755');
  });

  it('does nothing when there is no store', () => {
    expect(pruneStoreTrees(createMemoryState().ports, { core: 'cccccccccccc' })).toEqual([]);
  });
});
