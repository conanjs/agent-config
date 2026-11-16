// tool.ts — steps of tests/installer-variables/variables.feature (specs/022 T123): variables, set and the rendered variables file.
// Same composition as the other installer features: the test entry tests/support/installer-test-main.ts (T142) reads the fixture clone
// of agent-config from AGENT_CONFIG_TEST_REPO ({root}/repo here), and https://example.invalid/<name>.git is the local bare repository
// {root}/git-sources/<name>.git (git url rewrite set here).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { Given, Then } from '@cucumber/cucumber';
import { gitSourcesFolder } from '../support/installer-test-settings.ts';
import { installerRunner } from '../support/installer-world.ts';
import type { InstallerWorld } from '../support/installer-world.ts';
import { registerTool } from '../support/tools.mjs';
import type { ToolWorld } from '../support/tools.ts';

registerTool('installer-variables', {
  fixture: 'tests/installer-variables/fixtures/base',
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

Given('the variable home is confirmed', function (this: unknown) {
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
Given('the variable local list holds the path components {string}', function (this: unknown, names: string) {
  const world = this as ToolWorld;
  const lines = names
    .split(',')
    .map((n) => n.trim())
    .map((n) => `  - { name: ${n}, source: { type: path, path: '${world.at(`home/src/${n}`)}' } }`);
  const file = world.at('home/.agent-config/components.local.yaml');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, ['schema: components-list/v1', 'local: true', 'components:', ...lines, ''].join('\n'));
});

Given('the variable value file holds:', function (this: unknown, doc: string) {
  const world = this as ToolWorld;
  const file = world.at('home/.agent-config/variables.local.yaml');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(
    file,
    ['schema: variables-local/v1', 'values:', ...doc.split('\n').map((l) => `  ${l.trim()}`), ''].join('\n'),
  );
});

/** The rows of the variables table of a rendered file, after its header and separator, with the temporary folder written {root}. */
function tableRows(world: ToolWorld, file: string): string[] {
  const lines = fs.readFileSync(world.at(file), 'utf8').replaceAll(world.root, '{root}').split('\n');
  const header = lines.findIndex((l) => l.trim() === '| Variable | Value | Description | Declared by |');
  assert.ok(header >= 0, `${file} has no table with the header "| Variable | Value | Description | Declared by |"`);
  const rows: string[] = [];
  for (const line of lines.slice(header + 2)) {
    if (!line.trim().startsWith('|')) break;
    rows.push(line.trim());
  }
  return rows;
}

Then('the variable table in {string} has exactly these rows:', function (this: unknown, file: string, doc: string) {
  assert.deepEqual(
    tableRows(this as ToolWorld, file),
    doc
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean),
  );
});

Then('the variable table in {string} has no row for {string}', function (this: unknown, file: string, name: string) {
  const hit = tableRows(this as ToolWorld, file).find((row) => row.split('|')[1]?.trim() === name);
  assert.equal(hit, undefined, `${file} has a row for ${name}: ${hit}`);
});

Then('the variable output has no line containing {string}', function (this: unknown, text: string) {
  const { result } = this as ToolWorld;
  assert.ok(result, 'the tool has not run');
  const hit = result.out.split('\n').find((line) => line.includes(text));
  assert.equal(hit, undefined, `the output has a line containing "${text}": ${hit}`);
});

Then('the variable output has a line starting with {string}', function (this: unknown, start: string) {
  const { result } = this as ToolWorld;
  assert.ok(result, 'the tool has not run');
  assert.ok(
    result.out.split('\n').some((line) => line.startsWith(start)),
    `no output line starts with "${start}":\n${result.out}`,
  );
});

function filesUnder(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((e) => (e.isDirectory() ? filesUnder(path.join(dir, e.name)) : [path.join(dir, e.name)]));
}

Then(
  'a backup under {string} holds a file named {string} with the line {string}',
  function (this: unknown, backups: string, name: string, line: string) {
    const world = this as ToolWorld;
    const copies = filesUnder(world.at(backups)).filter(
      (f) => path.basename(f) === name && fs.readFileSync(f, 'utf8').split('\n').includes(line),
    );
    assert.ok(copies.length > 0, `no file named ${name} with the line "${line}" under ${backups}`);
  },
);
