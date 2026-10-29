// How the procedures validator runs on a scenario's fixture copy (specs/004).
import path from 'node:path';
import { codesFromCalls, registerTool, repo } from '../support/tools.mjs';

const validator = 'copilot/procedures/tools/validate-procedures.mjs';

registerTool('validate-procedures', {
  fixture: 'tests/validate-procedures/fixtures/base',
  run: (world, extra) => ({
    file: process.execPath,
    args: [path.join(repo, validator), world.at('procedures'), ...extra],
    // --upstream talks to the scenario's local server, never to GitHub, and sends no real token.
    env: { GITHUB_API_URL: world.server?.url ?? 'http://127.0.0.1:9', GITHUB_TOKEN: '' },
  }),
  header: /^procedures validate: /,
  normalize: [[/\(\d+ days ago/g, '(N days ago']],
  quietPass: 'PASS (0 warning(s))',
  codes: () => codesFromCalls(validator),
  rules: 'copilot/procedures',
});
