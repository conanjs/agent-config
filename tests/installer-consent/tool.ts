// tool.ts — steps of tests/installer-consent/needs.feature (specs/022 T121): the needs report, exit codes and consent of the installer.
// The installer under test is tests/support/installer-test-main.ts (the test entry, written with T142). It reads the fixture clone
// of agent-config from AGENT_CONFIG_TEST_REPO (set here to {root}/repo), and a git source named "kb-g" is the local bare
// repository {root}/git-sources/kb-g.git behind the address https://example.invalid/kb-g.git (git url rewrite, set here).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { Given, Then } from '@cucumber/cucumber';
import { gitSourcesFolder } from '../support/installer-test-settings.ts';
import { installerRunner } from '../support/installer-world.ts';
import type { InstallerWorld } from '../support/installer-world.ts';
import { registerTool } from '../support/tools.mjs';
import type { ToolWorld } from '../support/tools.ts';

registerTool('installer-consent', {
  fixture: 'tests/installer-consent/fixtures/base',
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

type Streams = { stdout: string; stderr: string };
const streams = (world: unknown): Streams => {
  const { result } = world as { result?: Streams };
  assert.ok(result, 'the tool has not run');
  return result;
};
const stateFile = (world: ToolWorld): string => world.at('home/.agent-config/install-state.json');

Given('the consent home is confirmed', function (this: unknown) {
  const world = this as ToolWorld;
  const state = {
    approved_privileged_hash: null,
    components: {},
    entries: [],
    home: world.at('home/.agent-config'),
    installer: { commit: '825ea82000000000000000000000000000000000', version: '0.2.0' },
    last_run: { command: 'install', exit: 0, time: '2026-11-19T09:00:00.000Z' },
    schema: 'install-state/v1',
  };
  fs.mkdirSync(path.dirname(stateFile(world)), { recursive: true });
  fs.writeFileSync(stateFile(world), JSON.stringify(state, null, 2) + '\n');
});

function reportOf(world: unknown): Record<string, unknown> {
  const parsed: unknown = JSON.parse(streams(world).stdout);
  assert.ok(
    parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed),
    'standard output is not one JSON object',
  );
  return parsed as Record<string, unknown>;
}

Then('the consent report on standard output is this JSON:', function (this: unknown, doc: string) {
  const world = this as ToolWorld;
  assert.deepEqual(reportOf(this), JSON.parse(doc.replaceAll('{root}', world.root)));
});

Then('the consent report has this need at position {int}:', function (this: unknown, position: number, doc: string) {
  const world = this as ToolWorld;
  const needs = reportOf(this)['needs'];
  assert.ok(Array.isArray(needs), 'the report has no needs list');
  assert.deepEqual(needs[position - 1], JSON.parse(doc.replaceAll('{root}', world.root)));
});

Then('the consent report lists the needs in the order {string}', function (this: unknown, order: string) {
  const needs = reportOf(this)['needs'];
  assert.ok(Array.isArray(needs), 'the report has no needs list');
  assert.equal(needs.map((n: { kind: string }) => n.kind).join(', '), order);
});

Then('the consent output has no line containing {string}', function (this: unknown, text: string) {
  const { result } = this as ToolWorld;
  assert.ok(result, 'the tool has not run');
  const hit = result.out.split('\n').find((line) => line.includes(text));
  assert.equal(hit, undefined, `the output has a line containing "${text}": ${hit}`);
});

Then('the consent output has a line starting with {string}', function (this: unknown, start: string) {
  const world = this as ToolWorld;
  assert.ok(world.result, 'the tool has not run');
  const wanted = start.replaceAll('{root}', world.root);
  assert.ok(
    world.result.out
      .split('\n')
      .some((line) => line.replaceAll(world.root, '{root}').startsWith(start) || line.startsWith(wanted)),
    `no output line starts with "${start}":\n${world.result.out}`,
  );
});

function approvedHash(world: ToolWorld): unknown {
  const state: unknown = JSON.parse(fs.readFileSync(stateFile(world), 'utf8'));
  return (state as { approved_privileged_hash?: unknown }).approved_privileged_hash;
}

Then('the consent state records an approved privileged set', function (this: unknown) {
  const hash = approvedHash(this as ToolWorld);
  assert.equal(typeof hash, 'string');
  assert.match(hash as string, /^[0-9a-f]{8,}$/);
});

Then('the consent state records no approved privileged set', function (this: unknown) {
  assert.equal(approvedHash(this as ToolWorld), null);
});
