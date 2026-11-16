// Tests of the schema check (specs/022 T078): AC-1.1 to AC-1.3, AC-1.7. The outputs are the lines tests/contracts/tool.ts describes.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  INDEX_CONTRACTS,
  checkContractFile,
  checkFile,
  checkIndex,
  reportLines,
  runCheckSchemas,
} from './check-schemas.ts';
import type { ToolEnv } from './tool-io.ts';

const header = '| Contract | Owner | Consumers | Versioning rule | Missing or stale |\n|---|---|---|---|---|\n';
const row = (id: string, cells = 'o | c | v | s'): string => `| ${id} | ${cells} |\n`;
const fullIndex = header + INDEX_CONTRACTS.map((id) => row(id)).join('');

describe('AC-1.1 the index', () => {
  it('passes with fifteen complete rows and counts them', () => {
    expect(checkIndex(fullIndex)).toMatchObject({ errors: [], contracts: 15 });
  });

  it('names the contract and the column of an empty cell', () => {
    const text = fullIndex.replace(row('hooks/v1'), row('hooks/v1', 'o | c |  | s'));
    expect(checkIndex(text).errors).toEqual([{ field: 'hooks/v1', message: 'Versioning rule is empty' }]);
  });

  it('names a contract with no row', () => {
    const text = fullIndex.replace(row('variables/v1'), '');
    expect(checkIndex(text).errors).toEqual([{ field: 'variables/v1', message: 'has no row in the index' }]);
  });

  it('does not count the rows of a second table', () => {
    const second = '\n| Interface | Owner |\n|---|---|\n| install report | x |\n';
    expect(checkIndex(fullIndex + second).contracts).toBe(15);
  });

  it('refuses a text with no contracts table', () => {
    expect(checkIndex('# nothing\n').errors[0]?.message).toContain('"Contract"');
  });
});

describe('AC-1.2 and AC-1.3 contract files, dispatched by their schema key', () => {
  const component = 'schema: component/v1\nname: agentic-sdlc\n';

  it('reports an unknown key as a warning and a missing schema key as an error', () => {
    expect(checkContractFile('schema: slots/v1\ncolour: blue\nslots: []\n').warnings[0]?.field).toBe('colour');
    expect(checkContractFile('name: x\n').errors[0]?.field).toBe('schema');
  });

  it('refuses a contract the tool has no file shape for', () => {
    expect(checkContractFile('schema: unknown-thing/v1\n').errors[0]?.message).toContain(
      'not a contract this tool has a file shape for',
    );
  });

  it('refuses an unreadable YAML text without quoting it', () => {
    const report = checkContractFile('a: [unclosed\n');
    expect(report.errors).toHaveLength(1);
    expect(report.errors[0]?.field).toBe('(document)');
  });

  it('dispatches index.md by file name and everything else by schema key', () => {
    expect(checkFile('docs/index.md', fullIndex).contracts).toBe(15);
    expect(checkFile('c.yaml', component).contracts).toBeUndefined();
  });
});

describe('AC-1.7 the lines of one file', () => {
  it('prints warnings, errors and ok, with the file name first', () => {
    expect(reportLines('f.yaml', { errors: [], warnings: [{ field: 'k', message: 'm' }] })).toEqual([
      'f.yaml: warning: k: m',
      'f.yaml: ok',
    ]);
    expect(reportLines('f.yaml', { errors: [{ field: 'k', message: 'm' }], warnings: [] })).toEqual([
      'f.yaml: error: k: m',
    ]);
    expect(reportLines('index.md', { errors: [], warnings: [], contracts: 15 })).toEqual([
      'index.md: ok (15 contracts)',
    ]);
  });

  it('replaces control characters from a file so one finding stays one line', () => {
    expect(reportLines('f', { errors: [{ field: 'a\nb\u001b[31m', message: 'm' }], warnings: [] })).toEqual([
      'f: error: a?b?[31m: m',
    ]);
  });
});

describe('AC-1.2 the command', () => {
  const folders: string[] = [];
  afterEach(() => {
    for (const folder of folders.splice(0)) fs.rmSync(folder, { recursive: true, force: true });
  });

  function envIn(files: Readonly<Record<string, string>>): ToolEnv {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'schemas-'));
    folders.push(root);
    for (const [file, text] of Object.entries(files)) fs.writeFileSync(path.join(root, file), text);
    return {
      cwd: root,
      home: '/h',
      platform: 'linux',
      today: '2026-11-14',
      nodeVersion: '24.12.0',
      gitHead: () => ({ ok: false, message: '' }),
      gitTracked: () => [],
    };
  }

  it('exits 0 when no file has an error and 1 when any has', () => {
    const env = envIn({ 'index.md': fullIndex, 'bad.yaml': 'name: x\n' });
    expect(runCheckSchemas(['index.md'], env)).toEqual({ code: 0, out: 'index.md: ok (15 contracts)\n', err: '' });
    expect(runCheckSchemas(['index.md', 'bad.yaml'], env).code).toBe(1);
  });

  it('reports a file that is not there as an error of that file', () => {
    expect(runCheckSchemas(['missing.yaml'], envIn({}))).toEqual({
      code: 1,
      out: 'missing.yaml: error: (document): cannot be read\n',
      err: '',
    });
  });

  it('exits 2 with no file or with an option', () => {
    expect(runCheckSchemas([], envIn({})).code).toBe(2);
    expect(runCheckSchemas(['--json', 'x'], envIn({})).code).toBe(2);
  });
});

describe('AC-1.1 the list of index rows', () => {
  it('is derived from the reader registry: fifteen ids, the lock sharing the list row', () => {
    expect(INDEX_CONTRACTS).toHaveLength(15);
    expect(INDEX_CONTRACTS).toContain('components-list/v1');
    expect(INDEX_CONTRACTS.some((id) => id.startsWith('components-lock'))).toBe(false);
  });
});
