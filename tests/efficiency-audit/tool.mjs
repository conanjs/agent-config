// How the efficiency auditor runs on a scenario's fixture copy (proposals/efficiency-auditor.md). "Now" is pinned to
// 2026-11-05T12:00:00Z (week of 2026-11-02) and the tracker's today to 2026-11-05; each tool's home folder is inside
// the scenario folder. A scenario that copies the tool into its folder (copilot/efficiency-audit/) runs that copy.
import fs from 'node:fs';
import path from 'node:path';
import { registerTool, repo } from '../support/tools.mjs';

const tool = 'copilot/efficiency-audit/efficiency-audit.mjs';
const schema = 'copilot/efficiency-audit/efficiency-audit.schema.md';

registerTool('efficiency-audit', {
  fixture: 'tests/efficiency-audit/fixtures/base',
  run: (world, extra) => ({
    file: process.execPath,
    args: [fs.existsSync(world.at(tool)) ? world.at(tool) : path.join(repo, tool), ...extra],
    env: {
      TZ: 'UTC',
      EFFICIENCY_AUDIT_NOW: '2026-11-05T12:00:00.000Z',
      TRACKER_TODAY: '2026-11-05',
      CLAUDE_CONFIG_DIR: world.at('claude-home'),
      CODEX_HOME: world.at('codex-home'),
      COPILOT_HOME: world.at('copilot-home'),
    },
  }),
  quietPass: '',
  // Rule ids are rows of the schema; every one must be named by a scenario (TST-14).
  codes: () => [...fs.readFileSync(path.join(repo, schema), 'utf8').matchAll(/^\| ((?:EA|AU)-\d+[a-z]?) \|/gm)].map((m) => m[1]),
  rules: 'copilot/efficiency-audit',
});
