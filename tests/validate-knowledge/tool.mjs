// How the knowledge validator runs on a scenario's fixture copy (specs/001).
import path from 'node:path';
import { codesFromCalls, registerTool, repo } from '../support/tools.mjs';

const validator = 'copilot/frameworks/knowledge/tools/validate-knowledge.mjs';

registerTool('validate-knowledge', {
  fixture: 'tests/validate-knowledge/fixtures/base',
  run: (world, extra) => ({
    file: process.execPath,
    args: [path.join(repo, validator), world.at('knowledge'), '--sdlc', world.at('agentic-sdlc'), '--companies', world.at('companies'), ...extra],
  }),
  header: /^knowledge validate: /,
  quietPass: 'PASS (0 warning(s))',
  codes: () => codesFromCalls(validator),
  rules: 'copilot/frameworks/knowledge/schemas',
});
