// How the agentic-sdlc framework validator runs on a scenario's fixture copy (specs/006).
import fs from 'node:fs';
import path from 'node:path';
import { Given } from '@cucumber/cucumber';
import { codesFromCalls, registerTool, repo } from '../support/tools.mjs';

const validator = 'copilot/frameworks/agentic-sdlc/tools/validate.mjs';

registerTool('validate-sdlc', {
  fixture: 'tests/validate-sdlc/fixtures/base',
  // A run names the knowledge root and the adapter map like the real callers do. A scenario that gives its own
  // --knowledge or --adapters replaces the default; "--no-knowledge" and "--no-adapters" (test-only) leave one out.
  run: (world, extra) => {
    const flags = extra.filter((a) => !a.startsWith('--no-'));
    const has = (name) => flags.includes(name) || extra.includes(`--no-${name.slice(2)}`);
    return {
      file: process.execPath,
      args: [path.join(repo, validator), world.at('repo/copilot/frameworks/agentic-sdlc'), '--repo', world.at('repo'),
        ...(has('--knowledge') ? [] : ['--knowledge', world.at('repo/copilot/knowledge')]),
        ...(has('--adapters') ? [] : ['--adapters', world.at('repo/adapters.json')]),
        ...flags],
      // --upstream talks to the scenario's local server, never to GitHub, and sends no real token.
      env: { GITHUB_API_URL: world.server?.url ?? 'http://127.0.0.1:9', GITHUB_TOKEN: '' },
    };
  },
  header: /^agentic-sdlc validate \(v2\): /,
  quietPass: 'PASS',
  codes: () => codesFromCalls(validator),
});

// Folder names are data in the scenarios of specs/022 AC-9.3: a fixture is built with other names.
Given('the folder {string} is renamed to {string}', function (from, to) {
  fs.mkdirSync(path.dirname(this.at(to)), { recursive: true });
  fs.renameSync(this.at(from), this.at(to));
});
