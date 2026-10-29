// How the project validator runs on a scenario's fixture copy (specs/007).
import path from 'node:path';
import { codesFromCalls, registerTool, repo } from '../support/tools.mjs';

const validator = 'copilot/frameworks/agentic-sdlc/tools/validate-project.mjs';

registerTool('validate-project', {
  fixture: 'tests/validate-project/fixtures/base',
  run: (world, extra) => ({
    file: process.execPath,
    args: [path.join(repo, validator), world.at('project'), '--framework', world.at('framework'), '--procedures', world.at('procedures'), ...extra],
    // {{AGENT_HOME}} in task refs resolves here, never in the real home folder.
    env: { AGENT_HOME: world.at('agent-home') },
  }),
  quietPass: 'PASS (0 warning(s))',
  codes: () => codesFromCalls(validator),
});
