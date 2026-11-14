// Parity of the two forms of each contract (specs/022 T046, DR-103): the JSON Schema checked with ajv, and the hand-written
// reader. Every shipped example of every contract runs through both, and both must give the verdict the folder promises:
// examples/valid/ passes, examples/invalid/ fails. A rule that only one form knows is caught here, so the schema other repos
// read and the reader the installer runs cannot drift apart.
//
// Layout read (T058 to T073): contracts/<name>/v<major>/schema.json (JSON Schema 2020-12), examples/valid/* and examples/invalid/*.
// The reader contract assumed (T055, contracts/lib/reader.ts):
//   readContract(id: string, text: string): { errors: readonly unknown[]; warnings: readonly unknown[] }
// where `id` is "<name>/v<major>" (the folder) and the document is valid when `errors` is empty (warnings do not count).
// The reader gets the raw text and ajv gets the raw parse of the same file (JSON.parse for .json and .lock, the yaml wrapper
// contracts/lib/yaml.ts otherwise (DR-102: the wrapper is the only importer); a file that does not parse fails the schema side), so neither form validates the other's output.
// Schemas avoid `format` (ajv-formats is not a dependency); they use `pattern`.
//
// The suite does not fail open. It is skipped only while no contract folder exists and T058 is not ticked in
// specs/022-repo-split/tasks.md; once T058 is ticked, contracts/slots/v1 must exist, and once T073 is ticked all sixteen
// folders must (the fifteen contracts of the index, with components-list and components-lock as two folders).
import fs from 'node:fs';
import path from 'node:path';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { readYaml } from './yaml.ts';

const contractsDir = path.resolve(import.meta.dirname, '..');
const tasksFile = path.resolve(contractsDir, '..', 'specs', '022-repo-split', 'tasks.md');

/** Ids of the tasks ticked [x] in tasks.md, read the same way as tests/support/pending.ts. */
const doneTasks: ReadonlySet<string> = new Set(
  [...fs.readFileSync(tasksFile, 'utf8').matchAll(/^- \[x\] (T\d{3}) /gm)].map((m) => m[1] ?? ''),
);

/** The contract folders T058 to T073 create, one task each. */
const expectedFolders = [
  'adapter-fields/v1',
  'agent-source/v1',
  'build/v1',
  'company-kb/v1',
  'component/v1',
  'components-list/v1',
  'components-lock/v1',
  'framework/v1',
  'hooks/v1',
  'knowledge-provider/v1',
  'rendered-copy/v1',
  'repo-layout/v1',
  'routes/v1',
  'skill-source/v1',
  'slots/v1',
  'variables/v1',
];

interface Example {
  readonly label: string;
  readonly file: string;
  readonly valid: boolean;
}

interface Contract {
  readonly id: string;
  readonly dir: string;
  readonly examples: readonly Example[];
}

interface ReadResult {
  readonly errors: readonly unknown[];
  readonly warnings: readonly unknown[];
}

type ReadContract = (id: string, text: string) => ReadResult;

function examplesIn(dir: string, valid: boolean): Example[] {
  const folder = path.join(dir, 'examples', valid ? 'valid' : 'invalid');
  if (!fs.existsSync(folder)) return [];
  return fs
    .readdirSync(folder)
    .filter((name) => !name.startsWith('.'))
    .sort()
    .map((name) => ({ label: `${valid ? 'valid' : 'invalid'}/${name}`, file: path.join(folder, name), valid }));
}

/** Every contracts/<name>/v<major>/ folder, with its examples. */
function discoverContracts(): Contract[] {
  const found: Contract[] = [];
  for (const entry of fs.readdirSync(contractsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    for (const major of fs.readdirSync(path.join(contractsDir, entry.name), { withFileTypes: true })) {
      if (!major.isDirectory() || !/^v\d+$/.test(major.name)) continue;
      const dir = path.join(contractsDir, entry.name, major.name);
      found.push({
        id: `${entry.name}/${major.name}`,
        dir,
        examples: [...examplesIn(dir, true), ...examplesIn(dir, false)],
      });
    }
  }
  return found.sort((a, b) => a.id.localeCompare(b.id));
}

async function loadReader(): Promise<ReadContract> {
  const file = path.join(contractsDir, 'lib', 'reader.ts');
  if (!fs.existsSync(file)) throw new Error('contracts/lib/reader.ts does not exist yet (T055)');
  const loaded: unknown = await import(pathToFileURL(file).href);
  const readContract = (loaded as { readContract?: unknown }).readContract;
  if (typeof readContract !== 'function') throw new Error('contracts/lib/reader.ts must export readContract(id, text)');
  return readContract as ReadContract;
}

function compileSchema(dir: string): ReturnType<Ajv2020['compile']> {
  const file = path.join(dir, 'schema.json');
  expect(fs.existsSync(file), `${file} is missing`).toBe(true);
  return new Ajv2020({ allErrors: true, strict: true }).compile(JSON.parse(fs.readFileSync(file, 'utf8')) as object);
}

/** The raw parse of an example for ajv: JSON for .json and .lock, YAML otherwise; undefined when the file does not parse. */
function rawParse(file: string): { readonly value: unknown } | undefined {
  const text = fs.readFileSync(file, 'utf8');
  if (/\.(json|lock)$/.test(file)) {
    try {
      return { value: JSON.parse(text) as unknown };
    } catch {
      return undefined;
    }
  }
  const read = readYaml(text);
  return read.ok ? { value: read.value } : undefined;
}

const contracts = discoverContracts();

describe('contract folders exist once their tasks are done', () => {
  it.skipIf(!doneTasks.has('T058'))('T058 is done, so contracts/slots/v1 exists', () => {
    expect(contracts.map((c) => c.id)).toContain('slots/v1');
  });

  it.skipIf(!doneTasks.has('T073'))('T073 is done, so all sixteen contract folders exist', () => {
    expect(contracts.map((c) => c.id)).toEqual(expect.arrayContaining(expectedFolders));
  });
});

describe.skipIf(contracts.length === 0)(
  'contract parity: schema.json (ajv) and the reader agree on every example',
  () => {
    describe.each(contracts)('$id', (contract) => {
      it('has a schema.json that compiles under JSON Schema 2020-12', () => {
        expect(() => compileSchema(contract.dir)).not.toThrow();
      });

      it('ships at least one valid and one invalid example', () => {
        expect(
          contract.examples.some((e) => e.valid),
          'no file in examples/valid/',
        ).toBe(true);
        expect(
          contract.examples.some((e) => !e.valid),
          'no file in examples/invalid/',
        ).toBe(true);
      });

      it.each(contract.examples)('$label: schema and reader both give the verdict of its folder', async (example) => {
        const readContract = await loadReader();
        const read = readContract(contract.id, fs.readFileSync(example.file, 'utf8'));
        const raw = rawParse(example.file);
        const verdicts = {
          bySchema: raw !== undefined && compileSchema(contract.dir)(raw.value),
          byReader: read.errors.length === 0,
        };
        expect(verdicts, `the folder says ${example.valid ? 'valid' : 'invalid'}`).toEqual({
          bySchema: example.valid,
          byReader: example.valid,
        });
      });
    });
  },
);
