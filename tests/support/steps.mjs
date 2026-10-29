// steps.mjs — the step definitions every tool feature shares.
//
// File changes use backtick strings so the text may contain quotes: in "<file>", `<old>` becomes `<new>`.
// Inside backticks, \n stands for a line break. In compared output, the temp folder reads {root} and the
// local web server's address reads {server}.

import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { Given, Then, When } from '@cucumber/cucumber';
import { getTool, repo } from './tools.mjs';

const unescape = (s) => s.replace(/\\n/g, '\n');
const fill = (world, s) => (world.server ? s.replaceAll('{server}', world.server.url) : s).replaceAll('{root}', world.root);

// ---- Given: the fixture and changes to it --------------------------------------------------------

Given('the base fixture tree of {string}', function (name) {
  this.toolName = name;
  fs.cpSync(path.join(repo, getTool(name).fixture), this.root, { recursive: true });
});

Given(/^the file "([^"]+)" contains:$/, function (file, doc) {
  fs.mkdirSync(path.dirname(this.at(file)), { recursive: true });
  fs.writeFileSync(this.at(file), fill(this, doc) + '\n');
});

Given(/^in "([^"]+)", `(.+?)` becomes `(.*)`$/, function (file, from, to) {
  const text = fs.readFileSync(this.at(file), 'utf8');
  assert.ok(text.includes(unescape(from)), `"${file}" does not contain \`${from}\``);
  fs.writeFileSync(this.at(file), text.replace(unescape(from), fill(this, unescape(to))));
});

Given(/^(\d+) lines are appended to "([^"]+)"$/, function (n, file) {
  fs.appendFileSync(this.at(file), 'x\n'.repeat(Number(n)));
});

Given(/^the (?:file|folder) "([^"]+)" is removed$/, function (p) {
  assert.ok(fs.existsSync(this.at(p)), `"${p}" does not exist`);
  fs.rmSync(this.at(p), { recursive: true });
});

Given(/^the folder "([^"]+)" exists$/, function (p) {
  fs.mkdirSync(this.at(p), { recursive: true });
});

Given('a local web server that answers {string} with that status code', function (pattern) {
  assert.equal(pattern, '/<code>');
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      res.statusCode = Number(req.url.slice(1).split(/[/?]/)[0]) || 200;
      res.end();
    });
    srv.listen(0, '127.0.0.1', () => {
      this.server = { srv, url: `http://127.0.0.1:${srv.address().port}` };
      resolve();
    });
  });
});

Given('a local web server that answers:', function (doc) {
  // One route per line: <path> <status> <body>, e.g. /repos/o/n/releases/latest 200 {"tag_name":"v1.0.0"}
  const routes = new Map(doc.split('\n').filter((l) => l.trim()).map((l) => {
    const [p, status, ...body] = l.trim().split(' ');
    return [p, { status: Number(status), body: body.join(' ') }];
  }));
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const r = routes.get(req.url) ?? { status: 404, body: '{"message":"Not Found"}' };
      res.writeHead(r.status, { 'content-type': 'application/json' });
      res.end(r.body);
    });
    srv.listen(0, '127.0.0.1', () => {
      this.server = { srv, url: `http://127.0.0.1:${srv.address().port}` };
      resolve();
    });
  });
});

// ---- When: run the tool ------------------------------------------------------------------------------

function run(world, extra) {
  const t = getTool(world.toolName);
  const { file, args, env } = t.run(world, extra);
  return new Promise((resolve) => {
    execFile(file, args, { encoding: 'utf8', env: { ...process.env, ...env } }, (err, stdout, stderr) => {
      let lines = (stdout + stderr).trimEnd().split('\n');
      if (t.header) {
        assert.match(lines[0], t.header, `first line is not the header:\n${stdout}${stderr}`);
        lines = lines.slice(1);
      }
      let out = lines.join('\n').replaceAll(world.root, '{root}');
      if (world.server) out = out.replaceAll(world.server.url, '{server}');
      for (const [re, to] of t.normalize ?? []) out = out.replace(re, to);
      world.result = { code: err ? err.code : 0, out };
      resolve();
    });
  });
}

When('the tool runs', function () {
  return run(this, []);
});

When('the tool runs with {string}', function (a) {
  return run(this, fill(this, a).split(' '));
});

// ---- Then: exact exit code and output ---------------------------------------------------------------

function expectOutput(world, code, expected) {
  const { out, code: got } = world.result;
  if (out !== expected.trimEnd() || got !== code) {
    throw new Error(`exit code ${got} (expected ${code}); output after the header:\n--- actual ---\n${out}\n--- expected ---\n${expected.trimEnd()}\n--- end ---`);
  }
}

Then('it passes with no warnings', function () {
  expectOutput(this, 0, getTool(this.toolName).quietPass);
});

Then('it exits with {int} and prints:', function (code, doc) {
  expectOutput(this, code, doc);
});

// ---- Then: traceability (TST-14) -------------------------------------------------------------------

const names = (world, code) => world.scenarioNames.some((s) => new RegExp(`(^|[^\\w-])${code}([^\\w-]|$)`).test(s));

Then('every rule code the tool prints is named by a scenario in this feature', function () {
  const missing = getTool(this.toolName).codes().filter((c) => !names(this, c));
  assert.deepEqual(missing, [], 'rule codes with no scenario');
});

Then('every rule code the tool prints is a rule row in its schemas', function () {
  const t = getTool(this.toolName);
  const dir = path.join(repo, t.rules);
  const text = fs.readdirSync(dir).filter((f) => f.endsWith('.md')).map((f) => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');
  const missing = t.codes().filter((c) => !new RegExp(`^\\| ${c} \\|`, 'm').test(text));
  assert.deepEqual(missing, [], 'rule codes with no rule row');
});
