// How the atlas tool runs on a scenario's fixture copy (specs/009).
import path from 'node:path';
import { codesFromCalls, registerTool, repo } from '../support/tools.mjs';

const tool = 'copilot/atlas/tools/atlas.mjs';

registerTool('atlas', {
  fixture: 'tests/atlas/fixtures/base',
  run: (world, extra) => ({
    file: process.execPath,
    args: [path.join(repo, tool), world.at('copilot/atlas/atlas.yaml'), ...extra.map((a) => a.replace('{root}', world.root))],
  }),
  header: /^atlas validate: /,
  quietPass: 'PASS (0 warning(s))',
  codes: () => codesFromCalls(tool),
  rules: 'copilot/atlas/schemas',
});
