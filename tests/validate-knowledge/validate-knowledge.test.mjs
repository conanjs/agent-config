// validate-knowledge.test.mjs — runs validate-knowledge.feature against the knowledge validator (specs/001).
//
// Usage: node --test tests/   (or scripts/check-docs.sh, which runs it with the validators)
// Each scenario copies fixtures/base to a temp folder, changes it, runs the validator on the copy,
// and compares the exit code and every output line after the dated header. In the output, the temp
// folder reads {root} and the local web server's address reads {server}.

import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { runFeature } from '../lib/gherkin.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..');
const validator = path.join(repo, 'copilot/frameworks/knowledge/tools/validate-knowledge.mjs');
const featureFile = path.join(here, 'validate-knowledge.feature');
const base = path.join(here, 'fixtures', 'base');

// `\n` inside a step's backtick string stands for a line break, so one-line steps can change multi-line text.
const unescape = (s) => s.replace(/\\n/g, '\n');

function run(ctx, extra) {
  const root = ctx.root;
  const args = [validator, path.join(root, 'knowledge'), '--sdlc', path.join(root, 'agentic-sdlc'), '--companies', path.join(root, 'companies'), ...extra];
  return new Promise((resolve) => {
    execFile(process.execPath, args, { encoding: 'utf8' }, (err, stdout) => {
      const lines = stdout.trimEnd().split('\n');
      assert.match(lines[0], /^knowledge validate: /, `first line is not the header:\n${stdout}`);
      let out = lines.slice(1).join('\n');
      out = out.replaceAll(root, '{root}');
      if (ctx.server) out = out.replaceAll(ctx.server.url, '{server}');
      ctx.result = { code: err ? err.code : 0, out };
      resolve();
    });
  });
}

function expectOutput(ctx, code, expected) {
  assert.equal(ctx.result.out, expected.trimEnd(), 'output after the header differs');
  assert.equal(ctx.result.code, code, 'exit code differs');
}

const steps = (ctx) => {
  const at = (p) => path.join(ctx.root, p);
  const fill = (s) => (ctx.server ? s.replaceAll('{server}', ctx.server.url) : s);
  return [
    [/^the base fixture tree$/, () => fs.cpSync(base, ctx.root, { recursive: true })],
    [/^the file "([^"]+)" contains:$/, (file, doc) => { fs.mkdirSync(path.dirname(at(file)), { recursive: true }); fs.writeFileSync(at(file), fill(doc) + '\n'); }],
    [/^in "([^"]+)", `(.+?)` becomes `(.*)`$/, (file, from, to) => {
      const text = fs.readFileSync(at(file), 'utf8');
      assert.ok(text.includes(unescape(from)), `"${file}" does not contain \`${from}\``);
      fs.writeFileSync(at(file), text.replace(unescape(from), fill(unescape(to))));
    }],
    [/^(\d+) lines are appended to "([^"]+)"$/, (n, file) => fs.appendFileSync(at(file), 'x\n'.repeat(+n))],
    [/^the (?:file|folder) "([^"]+)" is removed$/, (p) => { assert.ok(fs.existsSync(at(p)), `"${p}" does not exist`); fs.rmSync(at(p), { recursive: true }); }],
    [/^the folder "([^"]+)" exists$/, (p) => fs.mkdirSync(at(p), { recursive: true })],
    [/^a local web server that answers "\/<code>" with that status code$/, () => new Promise((resolve) => {
      const srv = http.createServer((req, res) => { res.statusCode = Number(req.url.slice(1).split('/')[0]) || 200; res.end(); });
      srv.listen(0, '127.0.0.1', () => { ctx.server = { srv, url: `http://127.0.0.1:${srv.address().port}` }; resolve(); });
    })],
    [/^the validator runs$/, () => run(ctx, [])],
    [/^the validator runs with "([^"]+)"$/, (a) => run(ctx, a.split(' '))],
    [/^it passes with no warnings$/, () => expectOutput(ctx, 0, 'PASS (0 warning(s))')],
    [/^it exits with (\d+) and prints:$/, (code, doc) => expectOutput(ctx, +code, doc)],
  ];
};

const feature = runFeature(featureFile, {
  world: () => ({ root: fs.mkdtempSync(path.join(os.tmpdir(), 'validate-knowledge-')) }),
  defs: steps,
  cleanup: (ctx) => { fs.rmSync(ctx.root, { recursive: true, force: true }); ctx.server?.srv.close(); },
});

// FR-004: every rule code the validator can print is named in at least one scenario title.
test('every rule code in the validator has a scenario', () => {
  const src = fs.readFileSync(validator, 'utf8');
  const codes = new Set();
  for (const m of src.matchAll(/\b(?:fail|warn)\)?\(([^,]+),/g)) for (const c of m[1].matchAll(/'([A-Z][A-Z0-9-]*)'/g)) codes.add(c[1]);
  assert.ok(codes.size > 10, `found only ${codes.size} rule codes; the extraction pattern no longer matches the validator`);
  const named = (code) => feature.scenarios.some((s) => new RegExp(`(^|[^\\w-])${code}([^\\w-]|$)`).test(s.name));
  assert.deepEqual([...codes].filter((c) => !named(c)).sort(), [], 'rule codes with no scenario');
});
