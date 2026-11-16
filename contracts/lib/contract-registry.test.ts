import { describe, expect, it } from 'vitest';
import { contentContracts } from './contract-shapes-content.ts';
import { toolingContracts } from './contract-shapes-tooling.ts';
import { coreContracts } from './contract-shapes.ts';

describe('contract registry (specs/022 T058 to T073)', () => {
  it('no contract name is defined in two of the three tables', () => {
    const names = [coreContracts, contentContracts, toolingContracts].flatMap((table) => Object.keys(table));
    expect(names.length).toBe(new Set(names).size);
  });
});
