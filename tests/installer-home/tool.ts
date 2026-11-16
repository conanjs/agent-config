// How the installer scenarios of the agent home (specs/022 T119, Story 2) run the installer: the test entry
// tests/support/installer-test-main.ts (written with the CompositionRoot task T142) through `installerRunner`.
// Besides the settings the World already gives (installer-world.ts), this tool sets two things the test entry must honour:
//   AGENT_CONFIG_TEST_REPO  the agent-config folder of the run: {root}/repo, holding components.yaml, component.yaml (core's
//                           manifest) and contracts/slots.yaml. The production entry takes it from where main.ts lives.
//   APPDATA                 {root}/appdata, so a Windows scenario can show that the home is not taken from APPDATA.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Then } from '@cucumber/cucumber';
import { installerRunner } from '../support/installer-world.ts';
import type { InstallerWorld } from '../support/installer-world.ts';
import { registerTool } from '../support/tools.mjs';

registerTool('installer-home', {
  fixture: 'tests/installer-home/fixtures/base',
  run: (world: InstallerWorld, extra: string[]) => {
    const run = installerRunner('tests/support/installer-test-main.ts')(world, extra);
    return {
      ...run,
      env: { ...run.env, AGENT_CONFIG_TEST_REPO: world.at('repo'), APPDATA: world.at('appdata') },
    };
  },
  quietPass: '',
  codes: () => [],
});

type Result = { code: number; out: string; stdout: string; stderr: string };
const resultOf = (world: unknown): Result => {
  const { result } = world as { result?: Result };
  assert.ok(result, 'the tool has not run');
  return result;
};

Then('the home report states {string} on its first line', function (this: unknown, line: string) {
  assert.equal(resultOf(this).out.split('\n')[0], line);
});

Then('the home report is one JSON document on standard output and nothing on standard error', function (this: unknown) {
  const { stdout, stderr } = resultOf(this);
  assert.doesNotThrow(() => JSON.parse(stdout), `standard output is not one JSON document:\n${stdout}`);
  assert.equal(stderr, '');
});

Then('the home report value {string} is {string}', function (this: unknown, dotted: string, expected: string) {
  let value: unknown = JSON.parse(resultOf(this).stdout);
  for (const key of dotted.split('.')) value = (value as Record<string, unknown> | undefined)?.[key];
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  assert.equal(text, expected.replaceAll('{root}', (this as InstallerWorld).root));
});

Then('the home state records the home {string}', function (this: unknown, home: string) {
  const world = this as InstallerWorld;
  const state = JSON.parse(fs.readFileSync(world.at('home/.agent-config/install-state.json'), 'utf8')) as {
    home?: string;
  };
  assert.equal(state.home, home.replaceAll('{root}', world.root));
});
