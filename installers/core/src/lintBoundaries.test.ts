// IMP-1 and the process rules of installers/eslint.config.mjs, proved on planted text: each case lints a few lines as if they were
// the file named, and reads the rule ids of the messages. The files named exist, so the type-aware parser can place them.
import path from 'node:path';
import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(import.meta.dirname, '..', '..', '..');
const modules = 'installers/core/src/modules';
const nameRules = `${modules}/shared/domain/name/NameRules.ts`;
const sha256Hex = `${modules}/shared/domain/hash/sha256Hex.ts`;
const stateTest = `${modules}/shared/domain/hash/sha256Hex.test.ts`;
const presenter = `${modules}/commands/interface/ConsolePresenter.ts`;
const eslint = new ESLint({ cwd: repoRoot });

async function ruleIds(file: string, code: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath: path.join(repoRoot, file) });
  return (result?.messages ?? []).map((message) => message.ruleId ?? 'parse-error');
}

const contracts = '../../../../../../../contracts';
const importOf = (target: string): string =>
  `import { x } from '${target}';\n/** The value under test, exported so the import is used. */\nexport const y = x;\n`;

describe('IMP-1 one file names contracts/lib relatively', () => {
  it.each([
    ['a file directly in contracts/lib', nameRules, `${contracts}/lib/value-problems.ts`, false],
    ['the same import in another file of the core', sha256Hex, `${contracts}/lib/value-problems.ts`, true],
    ['a path with dot dot after contracts/lib', nameRules, `${contracts}/lib/../x.ts`, true],
    ['a file in a folder below contracts/lib', nameRules, `${contracts}/lib/sub/x.ts`, true],
    ['contracts/tools, which does I/O', nameRules, `${contracts}/tools/build.ts`, true],
    ['a sibling module by a relative path', nameRules, '../../../state/application/x.ts', true],
  ])('%s', async (_title, file, target, refused) => {
    const ids = await ruleIds(file, importOf(target));
    expect(ids.includes('no-restricted-imports')).toBe(refused);
  });
}, 120_000);

// What the rule table of a file forbids, read from the calculated config, so a file that does not exist yet (main.ts, the
// presenter, both written by T138 and T142) is covered as well.
async function bannedSyntax(file: string): Promise<string[]> {
  const config = (await eslint.calculateConfigForFile(path.join(repoRoot, file))) as {
    rules?: Record<string, unknown[] | undefined>;
  };
  const entries = (config.rules?.['no-restricted-syntax'] ?? []).slice(1) as { selector: string }[];
  return entries.map((entry) => entry.selector);
}

const exitListener = (selectors: string[]): boolean => selectors.some((selector) => selector.includes('beforeExit'));
const processExit = (selectors: string[]): boolean => selectors.some((selector) => selector.includes('reallyExit'));
const processStream = (selectors: string[]): boolean => selectors.some((selector) => selector.includes('stdout'));

describe('the process rules', () => {
  const main = 'installers/core/main.ts';
  const cases: [title: string, file: string, listener: boolean, exit: boolean, stream: boolean][] = [
    ['a module file', sha256Hex, true, true, true],
    ['a unit test', stateTest, true, true, true],
    ['main.ts may call process.exit, but no listener and no stream', main, true, false, true],
    ['the presenter may write to a stream, but no listener and no exit', presenter, true, true, false],
    ['the composition root', 'installers/core/src/CompositionRoot.ts', true, true, true],
  ];
  it.each(cases)('%s', async (_title, file, listener, exit, stream) => {
    const selectors = await bannedSyntax(file);
    expect([exitListener(selectors), processExit(selectors), processStream(selectors)]).toEqual([
      listener,
      exit,
      stream,
    ]);
  });

  it.each([
    ['an exit listener', "process.on('exit', () => undefined);\n"],
    ['a beforeExit listener with once', "process.once('beforeExit', () => undefined);\n"],
    ['an exit listener with a template literal', 'process.on(`exit`, () => undefined);\n'],
    ['process.exit', 'process.exit(1);\n'],
    ['a write to process.stdout', "process.stdout.write('x');\n"],
    ['a named import of stdout', "import { stdout } from 'node:process';\nstdout.write('x');\n"],
    ['a renamed import of stderr from process', "import { stderr as e } from 'process';\ne.write('x');\n"],
    ['a namespace import of node:process', "import * as p from 'node:process';\np.stdout.write('x');\n"],
    ['a computed process access', "process['stdout'].write('x');\n"],
    ['a computed access through globalThis', "globalThis['process'].stdout.write('x');\n"],
    ['globalThis.process', "globalThis.process.stdout.write('x');\n"],
    ['global.process', "global.process.stderr.write('x');\n"],
    ['destructuring process', "const { stdout } = process;\nstdout.write('x');\n"],
    ['storing process in a variable', "const p = process;\np.stdout.write('x');\n"],
    ['passing process to a function', 'console.log(process);\n'],
    ['writeSync to a literal 1', "import fs from 'node:fs';\nfs.writeSync(1, 'x');\n"],
    ['writeSync to a literal 2 by name', "import { writeSync } from 'node:fs';\nwriteSync(2, 'x');\n"],
    [
      'a child process that inherits the streams',
      "import { spawn } from 'node:child_process';\nspawn('git', [], { stdio: 'inherit' });\n",
    ],
    [
      'a stdio list that inherits one stream',
      "import { spawn } from 'node:child_process';\nspawn('git', [], { stdio: ['pipe', 'inherit', 'pipe'] });\n",
    ],
    [
      'a stdio list that names fd 2',
      "import { spawn } from 'node:child_process';\nspawn('git', [], { stdio: ['pipe', 'pipe', 2] });\n",
    ],
  ])('refuses %s in a module file, as planted text', async (_title, code) => {
    expect(await ruleIds(stateTest, code)).toContain('no-restricted-syntax');
  });
}, 120_000);

describe('what the process rules leave alone', () => {
  it.each([
    ['process.exitCode', 'process.exitCode = 1;\n'],
    ['process.env', "export const home = process.env['HOME'];\n"],
    ['process.platform', 'export const platform = process.platform;\n'],
    [
      'a piped child process',
      "import { spawn } from 'node:child_process';\nspawn('git', [], { stdio: ['ignore', 'pipe', 'pipe'] });\n",
    ],
    ['a property named process', 'export const job = { process: 1 };\nexport const other = job.process;\n'],
    [
      'a write to a file descriptor held in a variable',
      "import fs from 'node:fs';\nexport const fd = fs.openSync('/tmp/x', 'w');\nfs.writeSync(fd, 'x');\n",
    ],
  ])('allows %s in a module file', async (_title, code) => {
    expect(await ruleIds(stateTest, code)).not.toContain('no-restricted-syntax');
  });
}, 120_000);
