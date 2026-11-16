// tool.ts — steps of tests/installer-resolution/resolve.feature (specs/022 T122): resolution of dependencies by slot.
// Same composition as the other installer features: the test entry tests/support/installer-test-main.ts (T142) reads the fixture clone
// of agent-config from AGENT_CONFIG_TEST_REPO ({root}/repo here), and https://example.invalid/<name>.git is the local bare repository
// {root}/git-sources/<name>.git (git url rewrite set here).
import fs from 'node:fs';
import path from 'node:path';
import { Given } from '@cucumber/cucumber';
import { gitSourcesFolder } from '../support/installer-test-settings.ts';
import { installerRunner } from '../support/installer-world.ts';
import type { InstallerWorld } from '../support/installer-world.ts';
import { registerTool } from '../support/tools.mjs';
import type { ToolWorld } from '../support/tools.ts';

registerTool('installer-resolution', {
  fixture: 'tests/installer-resolution/fixtures/base',
  run: (world: InstallerWorld, extra: string[]) => {
    const run = installerRunner('tests/support/installer-test-main.ts')(world, extra);
    return {
      ...run,
      env: {
        ...run.env,
        AGENT_CONFIG_TEST_REPO: world.at('repo'),
        GIT_CONFIG_COUNT: '1',
        GIT_CONFIG_KEY_0: `url.${gitSourcesFolder(world.root)}/.insteadOf`,
        GIT_CONFIG_VALUE_0: 'https://example.invalid/',
      },
    };
  },
  quietPass: '',
  codes: () => [],
});

Given('the resolver home is confirmed', function (this: unknown) {
  const world = this as ToolWorld;
  const file = world.at('home/.agent-config/install-state.json');
  const state = {
    approved_privileged_hash: null,
    components: {},
    entries: [],
    home: world.at('home/.agent-config'),
    installer: { commit: '825ea82000000000000000000000000000000000', version: '0.2.0' },
    last_run: { command: 'install', exit: 0, time: '2026-11-19T09:00:00.000Z' },
    schema: 'install-state/v1',
  };
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(state, null, 2) + '\n');
});

/** Writes home/.agent-config/components.local.yaml with one path source per name, each at {root}/home/src/<name>. */
Given('the resolver local list holds the path components {string}', function (this: unknown, names: string) {
  const world = this as ToolWorld;
  const lines = names
    .split(',')
    .map((n) => n.trim())
    .map((n) => `  - { name: ${n}, source: { type: path, path: '${world.at(`home/src/${n}`)}' } }`);
  const file = world.at('home/.agent-config/components.local.yaml');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, ['schema: components-list/v1', 'local: true', 'components:', ...lines, ''].join('\n'));
});
