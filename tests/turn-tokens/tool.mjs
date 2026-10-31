// How the turn token report runs on a scenario's fixture copy (specs/017). Times print in UTC and "now" is
// pinned to 2026-10-31T09:20:00Z; each tool's home folder is inside the scenario folder.
import fs from 'node:fs';
import path from 'node:path';
import { registerTool, repo } from '../support/tools.mjs';

const tool = 'copilot/hooks/turn-tokens/turn-tokens.mjs';
const schema = 'copilot/hooks/turn-tokens/turn-tokens.schema.md';

registerTool('turn-tokens', {
  fixture: 'tests/turn-tokens/fixtures/base',
  run: (world, extra) => ({
    file: process.execPath,
    args: [path.join(repo, tool), ...extra],
    env: {
      TZ: 'UTC',
      TURN_TOKENS_NOW: '2026-10-31T09:20:00.000Z',
      CLAUDE_CONFIG_DIR: world.at('claude-home'),
      CODEX_HOME: world.at('codex-home'),
    },
  }),
  quietPass: '',
  // The tool prints no rule codes; every TT rule of its schema must still be named by a scenario (TST-14).
  codes: () => [...fs.readFileSync(path.join(repo, schema), 'utf8').matchAll(/^\| (TT-\d+) \|/gm)].map((m) => m[1]),
  rules: 'copilot/hooks/turn-tokens',
});
