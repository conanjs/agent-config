// tool.ts — the installer under test for tests/installer-edges/edge-cases.feature (specs/022 T126, edge cases EDGE-1 to EDGE-15) and the
// steps that only this feature uses. Step phrases start with "the edge".
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { Given, Then } from '@cucumber/cucumber';
import { gitSourcesFolder } from '../support/installer-test-settings.ts';
import { installerRunner } from '../support/installer-world.ts';
import type { InstallerWorld } from '../support/installer-world.ts';
import { registerTool } from '../support/tools.mjs';

const entry = installerRunner('tests/support/installer-test-main.ts');

/** The installer's test entry, told which folder of the scenario stands for the agent-config checkout (core and the public list). */
registerTool('installer-edges', {
  fixture: 'tests/installer-edges/fixtures/base',
  run: (world: InstallerWorld, extra: string[]) => {
    const run = entry(world, extra);
    return {
      ...run,
      env: {
        ...run.env,
        AGENT_CONFIG_TEST_REPO: world.at('repo'),
        // A list names a git source as https://example.invalid/<name>.git, the only form the list schema accepts; git maps it to the bare repository.
        GIT_CONFIG_COUNT: '2',
        GIT_CONFIG_KEY_0: `url.${gitSourcesFolder(world.root)}/.insteadOf`,
        GIT_CONFIG_VALUE_0: 'https://example.invalid/',
        GIT_CONFIG_KEY_1: 'protocol.file.allow',
        GIT_CONFIG_VALUE_1: 'always',
      },
    };
  },
  quietPass: '',
  codes: () => [],
});

const as = (world: unknown): InstallerWorld => world as InstallerWorld;

/** A components-list file with path sources `sources/<name>` of the scenario. */
function listOf(world: InstallerWorld, names: string, local: boolean): string {
  const items = names
    .split(',')
    .filter((n) => n.trim() !== '')
    .map((n) => `  - name: ${n.trim()}\n    source: { type: path, path: ${world.root}/sources/${n.trim()} }`);
  const body = items.length > 0 ? `components:\n${items.join('\n')}\n` : 'components: []\n';
  return `schema: components-list/v1\nlocal: ${local}\n${body}`;
}

Given('the edge setup lists locally the path components {string}', function (this: unknown, names: string) {
  const world = as(this);
  fs.mkdirSync(world.at('home/.agent-config'), { recursive: true });
  fs.writeFileSync(world.at('home/.agent-config/components.local.yaml'), listOf(world, names, true));
});

Given('the edge setup lists publicly the path components {string}', function (this: unknown, names: string) {
  const world = as(this);
  fs.writeFileSync(world.at('repo/components.yaml'), listOf(world, names, false));
});

Given(
  'the edge setup lists publicly the path component {string} from {string}',
  function (this: unknown, name: string, folder: string) {
    const world = as(this);
    fs.writeFileSync(
      world.at('repo/components.yaml'),
      `schema: components-list/v1\nlocal: false\ncomponents:\n  - name: ${name}\n    source: { type: path, path: ${world.root}/sources/${folder} }\n`,
    );
  },
);

Given(
  'the edge setup lists locally the path component {string} from {string}',
  function (this: unknown, name: string, folder: string) {
    const world = as(this);
    fs.mkdirSync(world.at('home/.agent-config'), { recursive: true });
    fs.writeFileSync(
      world.at('home/.agent-config/components.local.yaml'),
      `schema: components-list/v1\nlocal: true\ncomponents:\n  - name: ${name}\n    source: { type: path, path: ${world.root}/sources/${folder} }\n`,
    );
  },
);

Given('the edge faults are cleared', function (this: unknown) {
  as(this).faults = [];
});

Given('the edge lock was taken at {string} by another run', function (this: unknown, started: string) {
  const world = as(this);
  fs.mkdirSync(world.at('home/.agent-config'), { recursive: true });
  fs.writeFileSync(
    world.at('home/.agent-config/install.lock'),
    `${JSON.stringify({ command: 'install', pid: 4242, started })}\n`,
  );
});

/** Every file under a folder, not following links. */
function files(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    return e.isDirectory() ? files(full) : e.isFile() ? [full] : [];
  });
}

Then('the edge check finds no machine-specific text under {string}', function (this: unknown, dir: string) {
  const world = as(this);
  const needles = [world.root, fs.realpathSync(world.root), 'Vinh Do'];
  const hits = files(world.at(dir)).filter((f) => {
    const text = fs.readFileSync(f, 'utf8');
    return needles.some((n) => text.includes(n));
  });
  assert.deepEqual(
    hits.map((f) => path.relative(world.root, f)),
    [],
    'these files name the temporary home or the user',
  );
});
