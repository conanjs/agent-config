// How the contracts scenarios of specs/022 (T045, T047, T048) run the schema check and read the repository's own files.
//
// The tool under test is contracts/tools/check-schemas.ts (T078). The command line these scenarios assume:
//   node contracts/tools/check-schemas.ts <file>...
//     A file named index.md is checked as the contracts index; every other file is read by the tolerant reader (T055)
//     and checked against the contract named by its `schema:` key.
//     One line per finding:  <file>: error: <field>: <message>   or   <file>: warning: <field>: <message>
//     One line per clean file: <file>: ok     (the index adds the number of contracts: "ok (15 contracts)")
//     Counting rule of the index: only the rows of the table whose first header cell is "Contract" count, one per row. A second
//     table (the in-repo interfaces: installer CLI, install report, install-state) is not counted, and the 15 is not a count of
//     the contract ids that appear (one row names both the component list and the lock).
//     Exit 0 when no file has an error (warnings allowed), 1 when any does.
//
// Pending scenarios carry @pending and @Tnnn tags; tests/support/pending.ts skips them (see its header).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { Then } from '@cucumber/cucumber';
import { parse } from 'yaml';
import { registerTool, repo } from '../support/tools.mjs';
import { scriptRunner, type ToolWorld } from '../support/tools.ts';

registerTool('contracts', {
  fixture: 'tests/contracts/fixtures/base',
  run: scriptRunner('contracts/tools/check-schemas.ts'),
  quietPass: '',
  codes: () => [],
});

// ---- The output of the schema check ------------------------------------------------------------------

function outputLines(world: unknown): string[] {
  const { result } = world as ToolWorld;
  assert.ok(result, 'the tool has not run');
  return result.out.split('\n');
}

Then('the check output has a line containing {string}', function (this: unknown, text: string) {
  assert.ok(
    outputLines(this).some((l) => l.includes(text)),
    `no output line contains "${text}":\n${outputLines(this).join('\n')}`,
  );
});

Then('the check output has a line containing {string} and {string}', function (this: unknown, a: string, b: string) {
  const lines = outputLines(this);
  assert.ok(
    lines.some((l) => l.includes(a) && l.includes(b)),
    `no output line contains both "${a}" and "${b}":\n${lines.join('\n')}`,
  );
});

Then('the check output has no line containing {string}', function (this: unknown, text: string) {
  const hit = outputLines(this).find((l) => l.includes(text));
  assert.equal(hit, undefined, `an output line contains "${text}": ${hit ?? ''}`);
});

Then(
  'the check output has exactly {int} line(s) containing {string}',
  function (this: unknown, count: number, text: string) {
    const hits = outputLines(this).filter((l) => l.includes(text));
    assert.equal(hits.length, count, `lines containing "${text}":\n${hits.join('\n')}`);
  },
);

// ---- Files of the repository itself (the shipped contracts, the constitution) ------------------------

function repoLines(file: string): string[] {
  return fs.readFileSync(path.join(repo, file), 'utf8').replace(/\r\n/g, '\n').split('\n');
}

Then('the repository file {string} has a line containing {string}', function (file: string, text: string) {
  assert.ok(
    repoLines(file).some((l) => l.includes(text)),
    `${file} has no line containing "${text}"`,
  );
});

Then('the repository file {string} has a line matching {string}', function (file: string, pattern: string) {
  const re = new RegExp(pattern);
  assert.ok(
    repoLines(file).some((l) => re.test(l)),
    `${file} has no line matching /${pattern}/`,
  );
});

/** The heading line that starts with `prefix` and the lines after it, up to the next heading of the same or a higher level. */
function section(file: string, prefix: string): string {
  const lines = repoLines(file);
  const start = lines.findIndex((l) => l.startsWith(prefix));
  assert.ok(start >= 0, `${file} has no heading starting with "${prefix}"`);
  const level = (lines[start] ?? '').match(/^#+/)?.[0].length ?? 1;
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((l) => {
    const hashes = l.match(/^(#+) /)?.[1];
    return hashes !== undefined && hashes.length <= level;
  });
  return [lines[start], ...(end < 0 ? rest : rest.slice(0, end))].join('\n');
}

Then(
  'in the repository file {string}, the section {string} does not contain {string}',
  function (file: string, heading: string, text: string) {
    assert.ok(
      !section(file, heading).toLowerCase().includes(text.toLowerCase()),
      `the section "${heading}" of ${file} contains "${text}"`,
    );
  },
);

Then(
  'in the repository file {string}, the section {string} contains {string}',
  function (file: string, heading: string, text: string) {
    assert.ok(
      section(file, heading).toLowerCase().includes(text.toLowerCase()),
      `the section "${heading}" of ${file} does not contain "${text}"`,
    );
  },
);

// ---- The slots instance (AC-1.4) ---------------------------------------------------------------------

function slotOf(file: string, name: string): Record<string, unknown> {
  const doc = parse(fs.readFileSync(path.join(repo, file), 'utf8')) as { slots?: Record<string, unknown>[] };
  const slot = doc.slots?.find((s) => s['name'] === name);
  assert.ok(slot, `${file} has no slot "${name}"`);
  return slot;
}

Then('the slots file {string} has the slot {string}', function (file: string, name: string) {
  slotOf(file, name);
});

Then(
  'the slot {string} of {string} has {string} equal to {string}',
  function (name: string, file: string, key: string, json: string) {
    assert.deepEqual(slotOf(file, name)[key], JSON.parse(json) as unknown);
  },
);

Then(
  'the slot {string} of {string} offers the contract {string}',
  function (name: string, file: string, contract: string) {
    const offered = slotOf(file, name)['contract'];
    assert.ok(
      Array.isArray(offered) ? offered.includes(contract) : offered === contract,
      `slot "${name}" offers ${JSON.stringify(offered)}`,
    );
  },
);
