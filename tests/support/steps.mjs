// steps.mjs — the step definitions every tool feature shares.
//
// File changes use backtick strings so the text may contain quotes: in "<file>", `<old>` becomes `<new>`.
// Inside backticks, \n stands for a line break. In compared output, the temp folder reads {root} and the
// local web server's address reads {server}.

import assert from 'node:assert/strict';
import { execFile, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { Given, Then, When } from '@cucumber/cucumber';
import { getTool, repo } from './tools.mjs';

const unescape = (s) => s.replace(/\\n/g, '\n');

// The environment for every process a scenario starts, without the GIT_* variables of an outer git command.
// A pre-commit hook runs these tests with GIT_INDEX_FILE (and for some commands GIT_DIR) set; inherited, they
// would make the scenarios' own git calls write into the outer repository's index.
const cleanEnv = (extra = {}) => ({
  ...Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('GIT_'))),
  ...extra,
});
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

Given('{string} is a git repository with everything committed', function (dir) {
  const git = (...a) => execFileSync('git', ['-C', this.at(dir), '-c', 'user.name=test', '-c', 'user.email=test@example.com', ...a], { stdio: 'pipe', env: cleanEnv() });
  git('init', '-q', '-b', 'main');
  git('add', '-A');
  git('commit', '-q', '-m', 'fixture');
});

Given('the repo\'s {string} folder is copied to {string}', function (from, to) {
  fs.cpSync(path.join(repo, from), this.at(to), { recursive: true });
});

Given('the command {string} prints {string}', function (cmd, text) {
  // A fake command on PATH (the tool entry puts {root}/bin first), e.g. uname reporting another OS.
  fs.mkdirSync(this.at('bin'), { recursive: true });
  fs.writeFileSync(this.at(`bin/${cmd}`), `#!/bin/sh\necho '${text}'\n`, { mode: 0o755 });
});

Given('{string} already links to {string}', function (link, target) {
  fs.mkdirSync(path.dirname(this.at(link)), { recursive: true });
  fs.symlinkSync(this.at(target), this.at(link));
});

// ---- When: run the tool ------------------------------------------------------------------------------

function run(world, extra) {
  const t = getTool(world.toolName);
  const { file, args, env } = t.run(world, extra);
  return new Promise((resolve) => {
    execFile(file, args, { encoding: 'utf8', env: cleanEnv(env) }, (err, stdout, stderr) => {
      let lines = (stdout + stderr).trimEnd().split('\n');
      // A tool that stops before printing its header (a missing root file, say) is compared in full.
      if (t.header && t.header.test(lines[0])) lines = lines.slice(1);
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

// Also used as a precondition ("Given the tool runs with …"); Cucumber matches steps regardless of keyword.
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

// ---- Then: files the tool left behind ------------------------------------------------------------

/** A path under the scenario folder; "<timestamp>" stands for the one timestamped folder in its parent. */
function resolveStamped(world, p) {
  if (!p.includes('<timestamp>')) return world.at(p);
  const [before, after] = p.split('<timestamp>');
  const dirs = fs.readdirSync(world.at(before));
  assert.equal(dirs.length, 1, `expected one timestamped folder in ${before}, found: ${dirs.join(', ')}`);
  return path.join(world.at(before), dirs[0], after);
}

Then('{string} is a symlink to {string}', function (link, target) {
  const p = resolveStamped(this, link);
  assert.ok(fs.lstatSync(p).isSymbolicLink(), `${link} is not a symlink`);
  assert.equal(fs.readlinkSync(p), this.at(target));
});

Then('{string} is a real file or folder, not a symlink', function (p) {
  assert.ok(!fs.lstatSync(this.at(p)).isSymbolicLink(), `${p} is a symlink`);
});

Then('{string} does not exist', function (p) {
  assert.ok(!fs.existsSync(this.at(p)) && !isLink(this.at(p)), `${p} exists`);
});

Then('the file {string} contains exactly:', function (p, doc) {
  assert.equal(fs.readFileSync(resolveStamped(this, p), 'utf8'), doc + '\n');
});

function isLink(p) {
  try { return fs.lstatSync(p).isSymbolicLink(); } catch { return false; }
}

Then('the file {string} has the line {string}', function (p, line) {
  const lines = fs.readFileSync(this.at(p), 'utf8').split('\n');
  assert.ok(lines.includes(line), `${p} has no line "${line}"`);
});

Then('the file {string} has no line containing {string}', function (p, text) {
  const hit = fs.readFileSync(this.at(p), 'utf8').split('\n').find((l) => l.includes(text));
  assert.equal(hit, undefined, `${p} has a line containing "${text}": ${hit}`);
});

Then('the output has the line {string}', function (line) {
  assert.ok(this.result.out.split('\n').includes(line), `no output line "${line}" in:\n${this.result.out}`);
});

Then('the output has no line {string}', function (line) {
  assert.ok(!this.result.out.split('\n').includes(line), `output line "${line}" in:\n${this.result.out}`);
});
