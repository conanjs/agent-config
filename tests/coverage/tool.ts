// How the acceptance-criterion coverage check is run by the scenarios (specs/022 T052):
// scripts/check-ac-coverage.ts --root <folder> --delivered <phases>. "real" as an argument points it at this repository.
import { registerTool, repo } from '../support/tools.mjs';
import { scriptRunner, type ToolWorld } from '../support/tools.ts';

const script = 'scripts/check-ac-coverage.ts';

registerTool('coverage', {
  fixture: 'tests/coverage/fixtures/base',
  run: (world: ToolWorld, extra: string[]) => {
    const real = extra.includes('real');
    const args = [...extra.filter((a) => a !== 'real'), '--root', real ? repo : world.root];
    return scriptRunner(script)(world, args);
  },
  quietPass: '',
  codes: () => [],
});
