// How the dry-run baseline is run by the scenarios (specs/022 T050): contracts/tools/build.ts budget --baseline …
// The folder to read is passed as --root; the HOME of the run is the scenario's temporary home.
import assert from 'node:assert/strict';
import { Given, Then } from '@cucumber/cucumber';
import { registerTool } from '../support/tools.mjs';
import { scriptRunner, type ToolWorld } from '../support/tools.ts';

const script = 'contracts/tools/build.ts';

registerTool('baseline', {
  fixture: 'tests/baseline/fixtures/base',
  run: (world: ToolWorld, extra: string[]) =>
    extra[0] === 'check-schemas'
      ? scriptRunner('contracts/tools/check-schemas.ts')(world, extra.slice(1))
      : scriptRunner(script)(world, [...extra, '--root', world.root]),
  quietPass: '',
  codes: () => [],
});

// ---- Steps for reading the JSON report (the field path is written agents.codex.characters) -------------

type World = ToolWorld & { remembered?: string };

/** The shared steps store `stdout` beside `out`; ToolWorld's own type lists only the two fields tools.ts uses. */
function stdoutOf(world: ToolWorld): string {
  assert.ok(world.result, 'the tool has not run');
  return (world.result as unknown as { stdout: string }).stdout;
}

function reportValue(world: ToolWorld, fieldPath: string): unknown {
  const report: unknown = JSON.parse(stdoutOf(world));
  return fieldPath
    .split('.')
    .reduce<unknown>((node, key) => (node as Record<string, unknown> | undefined)?.[key], report);
}

Then('the baseline report has the number {string}', function (this: unknown, fieldPath: string) {
  const value = reportValue(this as ToolWorld, fieldPath);
  assert.equal(typeof value, 'number', `${fieldPath} is ${JSON.stringify(value)}`);
});

Then('the baseline report has the text {string}', function (this: unknown, fieldPath: string) {
  const value = reportValue(this as ToolWorld, fieldPath);
  assert.ok(typeof value === 'string' && value.length > 0, `${fieldPath} is ${JSON.stringify(value)}`);
});

Then('the baseline report has no field {string}', function (this: unknown, fieldPath: string) {
  assert.equal(reportValue(this as ToolWorld, fieldPath), undefined);
});

Then('the baseline report field {string} is {int}', function (this: unknown, fieldPath: string, expected: number) {
  assert.equal(reportValue(this as ToolWorld, fieldPath), expected);
});

Then(
  'the baseline report field {string} is more than {int}',
  function (this: unknown, fieldPath: string, floor: number) {
    const value = reportValue(this as ToolWorld, fieldPath);
    assert.ok(
      typeof value === 'number' && value > floor,
      `${fieldPath} is ${JSON.stringify(value)}, not more than ${floor}`,
    );
  },
);

Then('the baseline report field {string} is a 40-digit commit id', function (this: unknown, fieldPath: string) {
  assert.match(String(reportValue(this as ToolWorld, fieldPath)), /^[0-9a-f]{40}$/);
});

// ---- Steps for reading rendered text, which is the whole output --------------------------------------

function outputLines(world: ToolWorld): string[] {
  return stdoutOf(world).split('\n');
}

Then('line {int} of the output is {string}', function (this: unknown, n: number, expected: string) {
  assert.equal(outputLines(this as ToolWorld)[n - 1], expected);
});

Then('line {int} of the output contains {string}', function (this: unknown, n: number, part: string) {
  const line = outputLines(this as ToolWorld)[n - 1] ?? '';
  assert.ok(line.includes(part), `line ${n} is "${line}"`);
});

Then('no line of the output contains {string}', function (this: unknown, part: string) {
  const hit = outputLines(this as ToolWorld).find((l) => l.includes(part));
  assert.equal(hit, undefined, `a line contains "${part}": ${hit}`);
});

Given('the output is remembered', function (this: unknown) {
  const world = this as World;
  assert.ok(world.result, 'the tool has not run');
  world.remembered = world.result.out;
});

Then('the output equals the remembered output', function (this: unknown) {
  const world = this as World;
  assert.ok(world.result && world.remembered !== undefined, 'nothing remembered');
  assert.equal(world.result.out, world.remembered);
});
