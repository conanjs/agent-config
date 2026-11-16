// How the scenarios of the entry scripts (specs/022 T128, FR-033, FR-035) run them: the REAL installers/install.sh on Mac and
// Linux (run with bash), the REAL installers/install.ps1 on Windows (run with Windows PowerShell), on their own OS.
//
// Two ways to start the script:
//   - the script of the repository itself, when a scenario makes no copy: it starts the real core (installers/core/main.ts)
//     with the real node of the machine (only the end-to-end scenario does this);
//   - a COPY of the repository's installers/ folder inside the scenario ("the entry script has its own copy of the installers in
//     <folder>"), so that a scenario can replace the legacy installer by a stub and run the script from a folder whose name
//     holds a space. The shim finds everything from the folder it lives in: <folder>/core/main.ts, <folder>/legacy/install.sh
//     (install.ps1 on Windows).
//
// The fake node. A scenario puts "a node" in a folder: a wrapper named node (node.cmd on Windows) that runs fake-node.mjs with the
// real node. The fake answers `--version` with the version the scenario gave it and records every other call in calls.log of its
// folder (one JSON object per call: args, and the environment variables AGENT_CONFIG_HOME and HOME), then exits with the code the
// scenario gave it (0 by default). So the contract the shim must keep is: the version is read by running `<node> --version`
// (the output is like v24.12.0, compared as numbers, so 24.9 is older than 24.12), and the run is `<node> <folder>/core/main.ts <args>`.
//
// The World gives the process HOME and USERPROFILE of the scenario's throwaway home, an empty NODE (the shim treats empty as unset,
// because a scenario cannot remove a variable) and no test entry: the entry scripts never use installer-test-main.ts.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { Given, Then } from '@cucumber/cucumber';
import { installerEnvironment } from '../support/installer-world.ts';
import type { InstallerWorld } from '../support/installer-world.ts';
import { registerTool, repo } from '../support/tools.mjs';

interface EntryWorld extends InstallerWorld {
  /** Folder (relative to the scenario) of the copy of installers/, when a scenario made one. */
  entryFolder?: string;
  nodeVariable?: string;
  pathFolders?: string[];
  limitedPath?: boolean;
}

const windows = process.platform === 'win32';
const entry = (self: unknown): EntryWorld => self as EntryWorld;

/** Absolute path of an executable found on the machine's own PATH. */
function findOnPath(name: string): string | null {
  for (const dir of (process.env['PATH'] ?? '').split(path.delimiter)) {
    const candidate = path.join(dir, name);
    try {
      fs.accessSync(candidate, fs.constants.X_OK);
      if (fs.statSync(candidate).isFile()) return fs.realpathSync(candidate);
    } catch {
      // not here
    }
  }
  return null;
}

/** The system commands a shell script may use, and nothing else: no node. */
function systemToolsFolder(world: EntryWorld): string {
  const folder = world.at(windows ? 'empty' : 'system-tools');
  fs.mkdirSync(folder, { recursive: true });
  if (windows) return folder;
  const names = [
    'bash',
    'sh',
    'dirname',
    'basename',
    'uname',
    'env',
    'cat',
    'sed',
    'grep',
    'awk',
    'tr',
    'head',
    'cut',
    'sort',
    'expr',
    'printf',
    'test',
    'readlink',
    'pwd',
    'ls',
    'mkdir',
    'rm',
    'dd',
    'date',
    'wc',
    'id',
    'whoami',
  ];
  for (const name of names) {
    const real = findOnPath(name);
    if (real && !fs.existsSync(path.join(folder, name))) fs.symlinkSync(real, path.join(folder, name));
  }
  return folder;
}

function scriptPath(world: EntryWorld): string {
  const folder = world.entryFolder === undefined ? path.join(repo, 'installers') : world.at(world.entryFolder);
  return path.join(folder, windows ? 'install.ps1' : 'install.sh');
}

function runEntry(world: EntryWorld, extra: string[]): { file: string; args: string[]; env: Record<string, string> } {
  const script = scriptPath(world);
  const folders = (world.pathFolders ?? []).map((f) => world.at(f));
  const system = world.limitedPath ? [systemToolsFolder(world)] : (process.env['PATH'] ?? '').split(path.delimiter);
  const env = {
    ...installerEnvironment(world),
    PATH: [...folders, ...system].join(path.delimiter),
    NODE: world.nodeVariable ?? '',
  };
  if (windows) {
    const powershell = path.join(
      process.env['SystemRoot'] ?? 'C:\\Windows',
      'System32',
      'WindowsPowerShell',
      'v1.0',
      'powershell.exe',
    );
    return {
      file: powershell,
      args: ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', script, ...extra],
      env,
    };
  }
  return { file: findOnPath('bash') ?? '/bin/bash', args: [script, ...extra], env };
}

registerTool('installer-entry', {
  fixture: 'tests/installer-entry/fixtures/base',
  run: runEntry,
  quietPass: '',
  codes: () => [],
});

// ---- Steps -------------------------------------------------------------------------------------------

const fill = (world: EntryWorld, text: string): string => text.replaceAll('{root}', world.root);
const normalize = (text: string): string =>
  text.includes(path.sep) || text.includes('/') ? path.normalize(text) : text;

Given('the entry script has its own copy of the installers in {string}', function (this: unknown, folder: string) {
  const world = entry(this);
  fs.cpSync(path.join(repo, 'installers'), world.at(folder), { recursive: true });
  world.entryFolder = folder;
});

Given(
  'the entry script has a node in {string} that reports {string}',
  function (this: unknown, folder: string, version: string) {
    const world = entry(this);
    const dir = world.at(folder);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'fake-node.mjs'),
      [
        "import fs from 'node:fs';",
        "import path from 'node:path';",
        "import { fileURLToPath } from 'node:url';",
        'const dir = path.dirname(fileURLToPath(import.meta.url));',
        "const config = JSON.parse(fs.readFileSync(path.join(dir, 'fake-node.json'), 'utf8'));",
        'const args = process.argv.slice(2);',
        "if (args.length === 1 && args[0] === '--version') { console.log(config.version); process.exit(0); }",
        "const env = { AGENT_CONFIG_HOME: process.env.AGENT_CONFIG_HOME ?? '', HOME: process.env.HOME ?? '' };",
        "fs.appendFileSync(path.join(dir, 'calls.log'), JSON.stringify({ args, env }) + '\\n');",
        'process.exit(config.exit);',
        '',
      ].join('\n'),
    );
    fs.writeFileSync(path.join(dir, 'fake-node.json'), JSON.stringify({ version, exit: 0 }));
    const fake = path.join(dir, 'fake-node.mjs');
    if (windows) fs.writeFileSync(path.join(dir, 'node.cmd'), `@echo off\r\n"${process.execPath}" "${fake}" %*\r\n`);
    else
      fs.writeFileSync(path.join(dir, 'node'), `#!/bin/sh\nexec "${process.execPath}" "${fake}" "$@"\n`, {
        mode: 0o755,
      });
  },
);

Given("the entry script's node in {string} exits with {int}", function (this: unknown, folder: string, code: number) {
  const file = entry(this).at(path.join(folder, 'fake-node.json'));
  const config = JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, unknown>;
  fs.writeFileSync(file, JSON.stringify({ ...config, exit: code }));
});

Given("the entry script's NODE variable is the node in {string}", function (this: unknown, folder: string) {
  const world = entry(this);
  world.nodeVariable = world.at(path.join(folder, windows ? 'node.cmd' : 'node'));
});

Given("the entry script's NODE variable is {string}", function (this: unknown, value: string) {
  const world = entry(this);
  world.nodeVariable = fill(world, value);
});

Given("the entry script's PATH starts with the folder {string}", function (this: unknown, folder: string) {
  (entry(this).pathFolders ??= []).push(folder);
});

Given("the entry script's PATH holds the system commands and no node", function (this: unknown) {
  entry(this).limitedPath = true;
});

Given("the entry script's legacy installer is a stub that prints its arguments", function (this: unknown) {
  const world = entry(this);
  assert.ok(world.entryFolder, 'the scenario has no copy of the installers');
  const dir = world.at(path.join(world.entryFolder, 'legacy'));
  fs.mkdirSync(dir, { recursive: true });
  if (windows) {
    fs.writeFileSync(
      path.join(dir, 'install.ps1'),
      'Write-Output "legacy installer ran"\r\nforeach ($a in $args) { Write-Output "arg: $a" }\r\nexit 0\r\n',
    );
  } else {
    fs.writeFileSync(
      path.join(dir, 'install.sh'),
      '#!/usr/bin/env bash\necho "legacy installer ran"\nfor a in "$@"; do echo "arg: $a"; done\nexit 0\n',
      { mode: 0o755 },
    );
  }
});

function calls(world: EntryWorld, folder: string): { args: string[]; env: Record<string, string> }[] {
  const file = world.at(path.join(folder, 'calls.log'));
  if (!fs.existsSync(file)) return [];
  return fs
    .readFileSync(file, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as { args: string[]; env: Record<string, string> });
}

Then("the entry script's node in {string} was started with:", function (this: unknown, folder: string, doc: string) {
  const world = entry(this);
  const all = calls(world, folder);
  assert.equal(all.length, 1, `expected one start of the node in "${folder}", got ${all.length}`);
  assert.deepEqual(
    all[0]?.args.map(normalize),
    doc.split('\n').map((line) => normalize(fill(world, line))),
  );
});

Then("the entry script's node in {string} was never started", function (this: unknown, folder: string) {
  assert.deepEqual(calls(entry(this), folder), []);
});

Then(
  "the entry script's node in {string} saw the agent home {string}",
  function (this: unknown, folder: string, home: string) {
    const world = entry(this);
    const all = calls(world, folder);
    assert.equal(all.length, 1, `expected one start of the node in "${folder}", got ${all.length}`);
    assert.equal(all[0]?.env['AGENT_CONFIG_HOME'], fill(world, home));
  },
);
