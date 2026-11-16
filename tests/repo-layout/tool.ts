// How the repo-layout check is run by the scenarios (specs/022 T051): contracts/tools/build.ts layout [--report] --root <folder>.
// "real" as an argument points the check at this repository instead of the scenario's fixture.
import assert from 'node:assert/strict';
import { Then } from '@cucumber/cucumber';
import { registerTool, repo } from '../support/tools.mjs';
import { scriptRunner, type ToolWorld } from '../support/tools.ts';

registerTool('repo-layout', {
  fixture: 'tests/repo-layout/fixtures/base',
  run: (world: ToolWorld, extra: string[]) => {
    const real = extra.includes('real');
    const args = [...extra.filter((a) => a !== 'real'), '--root', real ? repo : world.root];
    // build.ts dispatches to layout.ts (T077); the scenarios go through the entry point a user would run.
    return scriptRunner('contracts/tools/build.ts')(world, ['layout', ...args]);
  },
  quietPass: '',
  codes: () => [],
});

Then('the output has a line starting with {string}', function (this: unknown, start: string) {
  const world = this as ToolWorld;
  assert.ok(world.result, 'the tool has not run');
  assert.ok(
    world.result.out.split('\n').some((l) => l.startsWith(start)),
    `no output line starts with "${start}":\n${world.result.out}`,
  );
});
