// How the bash installers run on a scenario's fixture copy (specs/008). The Background copies the real
// installers/ folder into the fixture repo, so the scripts under test are always the current ones.
import path from 'node:path';
import { registerTool } from '../support/tools.mjs';

registerTool('installers', {
  fixture: 'tests/installers/fixtures/base',
  run: (world, [script, ...rest]) => ({
    file: 'bash',
    args: [world.at(`repo/installers/${script}`), ...rest],
    // A private HOME, and {root}/bin first on PATH for fake commands (uname).
    env: { HOME: world.at('home'), PATH: `${world.at('bin')}${path.delimiter}${process.env.PATH}` },
  }),
  normalize: [[/\b\d{14}\b/g, '<timestamp>']],
  quietPass: '',
  codes: () => [],
});
