import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { findSeamLeaks, formatSeamLeaks } from '../support/seam-guard.ts';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');
let root = '';

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'seam-guard-'));
});
afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

function put(file: string, text: string): void {
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  fs.writeFileSync(path.join(root, file), text);
}

describe('T118 seam guard', () => {
  it('T118: the production tiers of this repository name no test seam', () => {
    expect(formatSeamLeaks(findSeamLeaks(repoRoot))).toEqual([]);
  });

  it('T118: a tier folder that does not exist has nothing to report', () => {
    expect(findSeamLeaks(root)).toEqual([]);
  });

  it.each([
    [
      "import { x } from '../../../tests/support/fault-adapters.ts';",
      ['imports a path under tests/', 'names a ../tests/ path', 'names a test support file'],
    ],
    ["import { x } from '../installer-world.ts';", ['names a test support file']],
    ["const v = process.env['AGENT_CONFIG_TEST_NOW'];", ['names a test environment variable']],
    ['const m = await import(process.argv[2]);', ['imports a computed path']],
    ["const m = require('../../tests/x.cjs');", ['imports a path under tests/', 'names a ../tests/ path']],
    ['const m = require(name);', ['requires a computed path']],
    ["import { createRequire } from 'node:module';", ['uses createRequire']],
    ['const r = eval(code);', ['runs code from a string']],
    ["const f = new Function('a', 'return a');", ['runs code from a string']],
    ["const w = new Worker('./w.js');", ['starts a worker']],
    ["const p = '../tests/data.json';", ['names a ../tests/ path']],
  ])('T118: reports %s', (line, reasons) => {
    put('installers/core/main.ts', `${line}\n`);
    expect(findSeamLeaks(root).map((leak) => leak.reason).sort()).toEqual([...reasons].sort());
  });

  it('T118: reports the file and the line number', () => {
    put('installers/core/src/a.ts', "const a = 1;\nconst b = 'AGENT_CONFIG_TEST_FAULT';\n");
    expect(formatSeamLeaks(findSeamLeaks(root))).toEqual(['installers/core/src/a.ts:2: names a test environment variable']);
  });

  it('T118: reports a package.json imports alias that points into tests/', () => {
    put('installers/core/package.json', '{ "imports": { "#helpers/*": "./../../tests/support/*.ts" } }\n');
    expect(findSeamLeaks(root).map((leak) => leak.reason)).toContain('has an imports alias into tests/');
  });

  it('T118: reports the same alias in the root package.json, and leaves its other lines alone', () => {
    put('package.json', '{\n  "scripts": { "test": "vitest ../tests/x" },\n  "imports": { "#t/*": "./tests/*.ts" }\n}\n');
    expect(formatSeamLeaks(findSeamLeaks(root))).toEqual(['package.json:3: has an imports alias into tests/']);
  });

  it('T118: allows a root alias that points into the installer', () => {
    put('package.json', '{ "imports": { "#installer/*": "./installers/core/src/*.ts" } }\n');
    expect(findSeamLeaks(root)).toEqual([]);
  });

  it('T118: scans the shell and PowerShell shims too', () => {
    put('installers/install.sh', 'export AGENT_CONFIG_TEST_FAULT=fail-write:1\n');
    put('installers/install.ps1', '$env:AGENT_CONFIG_TEST_FAULT = "x"\n');
    expect(findSeamLeaks(root).map((leak) => leak.file)).toEqual(['installers/install.ps1', 'installers/install.sh']);
  });

  it('T118: skips unit tests, node_modules and vendored code, and allows literal imports of production files', () => {
    put('installers/core/src/x.test.ts', "import '../../../tests/support/fault-adapters.ts';\n");
    put('installers/core/node_modules/p/index.js', "import('../../../tests/x');\n");
    put('contracts/lib/vendor/yaml/y.js', 'AGENT_CONFIG_TEST_\n');
    put('installers/core/main.ts', "import { composeInstaller } from './src/CompositionRoot.ts';\nawait import('./src/later.ts');\n");
    expect(findSeamLeaks(root)).toEqual([]);
  });
});
