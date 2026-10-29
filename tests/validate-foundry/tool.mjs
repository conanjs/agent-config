// How the agent-foundry validator runs on a scenario's fixture copy (specs/005).
import path from 'node:path';
import { codesFromCalls, registerTool, repo } from '../support/tools.mjs';

const validator = 'copilot/frameworks/agent-foundry/tools/validate-foundry.mjs';

registerTool('validate-foundry', {
  fixture: 'tests/validate-foundry/fixtures/base',
  run: (world, extra) => ({
    file: process.execPath,
    args: [path.join(repo, validator), world.at('foundry'), '--rules', world.at('rules'), ...extra],
  }),
  // The validator prints no header; its summary is the last line, after a blank line.
  normalize: [[/^\n/, '']],
  quietPass: 'agent-foundry: 0 failure(s), 0 warning(s); 6 markdown files, 1 floors, 3 rule ids loaded',
  codes: () => codesFromCalls(validator),
});
