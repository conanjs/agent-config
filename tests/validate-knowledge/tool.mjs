// How the knowledge validator runs on a scenario's fixture copy (specs/001).
import path from 'node:path';
import { codesFromCalls, registerTool, repo } from '../support/tools.mjs';

const validator = 'copilot/frameworks/knowledge/tools/validate-knowledge.mjs';

registerTool('validate-knowledge', {
  fixture: 'tests/validate-knowledge/fixtures/base',
  // "--only-knowledge" is accepted and dropped: the validator always reads the knowledge folder alone.
  run: (world, extra) => ({
    file: process.execPath,
    args: [path.join(repo, validator), world.at('knowledge'), ...extra.filter((a) => a !== '--only-knowledge')],
  }),
  header: /^knowledge validate: /,
  quietPass: 'PASS (0 warning(s))',
  codes: () => codesFromCalls(validator),
  rules: 'copilot/frameworks/knowledge/schemas',
});
