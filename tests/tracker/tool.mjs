// How the tracker tool runs on a scenario's fixture copy (specs/015). "Today" is pinned to 2026-10-30.
import path from 'node:path';
import { codesFromCalls, registerTool, repo } from '../support/tools.mjs';

const tool = 'copilot/tracker/tracker.mjs';

registerTool('tracker', {
  fixture: 'tests/tracker/fixtures/base',
  run: (world, extra) => ({
    file: process.execPath,
    args: [path.join(repo, tool), ...(extra.length ? extra : [world.root])],
    env: { TRACKER_TODAY: '2026-10-30' },
  }),
  header: /^tracker check: /,
  quietPass: 'PASS (0 warning(s))',
  codes: () => codesFromCalls(tool),
  rules: 'copilot/tracker',
});
