// How the fitness check is run by the scenarios (specs/022 T049): scripts/check-fitness.ts --root <folder>.
// "real" as an argument points the check at this repository instead of the scenario's fixture.
import { registerTool, repo } from '../support/tools.mjs';
import { scriptRunner, type ToolWorld } from '../support/tools.ts';

const script = 'scripts/check-fitness.ts';

registerTool('fitness', {
  fixture: 'tests/fitness/fixtures/base',
  run: (world: ToolWorld, extra: string[]) => {
    const real = extra.includes('real');
    const args = [...extra.filter((a) => a !== 'real'), '--root', real ? repo : world.root];
    return scriptRunner(script)(world, args);
  },
  quietPass: '',
  codes: () => [],
});
