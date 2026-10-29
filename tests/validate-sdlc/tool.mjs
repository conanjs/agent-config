// How the agentic-sdlc framework validator runs on a scenario's fixture copy (specs/006).
import path from 'node:path';
import { codesFromCalls, registerTool, repo } from '../support/tools.mjs';

const validator = 'copilot/frameworks/agentic-sdlc/tools/validate.mjs';

registerTool('validate-sdlc', {
  fixture: 'tests/validate-sdlc/fixtures/base',
  // "--no-repo" (test-only) leaves out --repo, so the validator has to find the repo itself.
  run: (world, extra) => ({
    file: process.execPath,
    args: [path.join(repo, validator), world.at('repo/copilot/frameworks/agentic-sdlc'),
      ...(extra[0] === '--no-repo' ? extra.slice(1) : ['--repo', world.at('repo'), ...extra])],
    // --upstream talks to the scenario's local server, never to GitHub, and sends no real token.
    env: { GITHUB_API_URL: world.server?.url ?? 'http://127.0.0.1:9', GITHUB_TOKEN: '' },
  }),
  header: /^agentic-sdlc validate \(v2\): /,
  quietPass: 'PASS',
  codes: () => codesFromCalls(validator),
});
