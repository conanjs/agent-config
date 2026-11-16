// How the shared support of tests/support/tools.ts runs a tool, on a stand-in tool in the fixture (specs/022 T043).
import { registerTool } from '../support/tools.mjs';
import { scriptRunner, type ToolWorld } from '../support/tools.ts';

registerTool('tools-support', {
  fixture: 'tests/tools-support/fixtures/base',
  run: (world: ToolWorld, extra: string[]) =>
    scriptRunner(extra[0] === 'sh' ? 'bin/probe.sh' : 'bin/probe.mjs', { inFixture: true })(
      world,
      extra[0] === 'sh' ? extra.slice(1) : extra,
    ),
  quietPass: '',
  codes: () => [],
});
