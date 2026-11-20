// How the core instruction text is checked by the scenarios (specs/022 T095): node tests/core-text/check-core.ts --file <path> [--only <group>].
// "real" as an argument points the check at home/instructions/core.instructions.md of this repository instead of the scenario's copy;
// "--only var|home|approval" runs one rule group (see check-core.ts). The steps that read real repository files are in real-steps.ts.
import path from 'node:path';
import { registerTool, repo } from '../support/tools.mjs';
import { scriptRunner, type ToolWorld } from '../support/tools.ts';
import { GROUP_NAMES } from './check-core.ts';
import './real-steps.ts';

registerTool('core-text', {
  fixture: 'tests/core-text/fixtures/base',
  run: (world: ToolWorld, extra: string[]) => {
    const real = extra.includes('real');
    const only = extra[extra.indexOf('--only') + 1];
    if (only !== undefined && extra.includes('--only') && !GROUP_NAMES.includes(only))
      throw new Error(`unknown group ${only}`);
    const file = real
      ? path.join(repo, 'home', 'instructions', 'core.instructions.md')
      : world.at('core.instructions.md');
    return scriptRunner('tests/core-text/check-core.ts')(world, ['--file', file, ...extra.filter((a) => a !== 'real')]);
  },
  quietPass: '',
  codes: () => [],
});
