// The schema check (specs/022 T078, AC-1.1 to AC-1.4, AC-1.7, FR-004, FR-005): reads each file given with the contract reader and prints
//   <file>: error: <field>: <message>      <file>: warning: <field>: <message>      <file>: ok
// A file is checked against the contract its own `schema:` key names; a file called index.md is the contracts index. Exit 0 when no
// file has an error (warnings are allowed), 1 when any has, 2 for a wrong command line. Run it as `node contracts/tools/check-schemas.ts
// <file>...` or as `build.ts check-schemas <file>...`.
import fs from 'node:fs';
import path from 'node:path';
import { contractDefinitions } from '#contracts/lib/contract-registry.ts';
import { readContract } from '#contracts/lib/reader.ts';
import type { Finding } from '#contracts/lib/shape.ts';
import { MAX_YAML_BYTES, readYaml } from '#contracts/lib/yaml.ts';
import { ExitCode, failure, oneLine, realEnv, type Outcome, type ToolEnv } from './tool-io.ts';

/** The contract that shares its index row with another: the lock is listed with the component list. */
const SHARES_ROW_WITH_LIST = 'components-lock';

/**
 * The fifteen contracts the index must list (AC-1.1), derived from the reader's registry so no second list can drift; the lock has no row of its own.
 * Each is `name/v<newest major>`, the id the first cell of its row starts with.
 */
export const INDEX_CONTRACTS: readonly string[] = Object.entries(contractDefinitions)
  .filter(([name]) => name !== SHARES_ROW_WITH_LIST)
  .map(([name, definition]) => `${name}/v${Math.max(...Object.keys(definition.majors).map(Number))}`);

/** The columns every index row must fill, in the words of the header. */
export const INDEX_COLUMNS: readonly string[] = ['Owner', 'Consumers', 'Versioning rule', 'Missing or stale'];

/** What checking one file found: errors and warnings, each with a field, and the contract count of an index. */
export interface FileReport {
  /** What makes the file fail. */
  readonly errors: readonly Finding[];
  /** What the file may keep. */
  readonly warnings: readonly Finding[];
  /** For the index: the number of rows of the contracts table, shown after `ok`. */
  readonly contracts?: number;
}

const DOCUMENT = '(document)';

function cellsOf(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

function contractRows(lines: readonly string[]): { header: string[]; rows: string[][] } | undefined {
  const start = lines.findIndex(
    (line, at) =>
      line.trim().startsWith('|') && cellsOf(line)[0] === 'Contract' && /^\s*\|[\s:|-]+$/.test(lines[at + 1] ?? ''),
  );
  if (start < 0) return undefined;
  const rows: string[][] = [];
  for (const line of lines.slice(start + 2)) {
    if (!line.trim().startsWith('|')) break;
    rows.push(cellsOf(line));
  }
  return { header: cellsOf(lines[start] ?? ''), rows };
}

/**
 * Checks the contracts index: one row for each of the fifteen contracts, each with owner, consumers, versioning rule and missing or stale filled.
 *
 * Only the rows of the table whose first header cell is `Contract` count; a second table, such as the in-repo interfaces, does not.
 *
 * @param text - the whole of index.md
 * @returns the missing rows and empty cells as errors, and the number of rows counted
 */
export function checkIndex(text: string): FileReport {
  const table = contractRows(text.split(/\r?\n/));
  if (table === undefined) {
    return { errors: [{ field: DOCUMENT, message: 'has no table whose first column is "Contract"' }], warnings: [] };
  }
  const columns = INDEX_COLUMNS.map((name) => ({ name, at: table.header.indexOf(name) }));
  const errors: Finding[] = columns
    .filter((column) => column.at < 0)
    .map((column) => ({ field: DOCUMENT, message: `the table has no column "${column.name}"` }));
  for (const contract of INDEX_CONTRACTS) {
    const row = table.rows.find((cells) => (cells[0] ?? '').startsWith(contract));
    if (row === undefined) errors.push({ field: contract, message: 'has no row in the index' });
    else {
      for (const column of columns.filter((each) => each.at >= 0 && (row[each.at] ?? '') === '')) {
        errors.push({ field: contract, message: `${column.name} is empty` });
      }
    }
  }
  return { errors, warnings: [], contracts: table.rows.length };
}

function sniff(text: string): { schema?: unknown; problem?: string } {
  try {
    return { schema: (JSON.parse(text) as { schema?: unknown } | null)?.schema };
  } catch {
    // Not JSON: a YAML file, whose own reader gives the reasons.
  }
  const read = readYaml(text);
  if (!read.ok) return { problem: read.findings.map((finding) => finding.message).join('; ') };
  const doc = read.value;
  return typeof doc === 'object' && doc !== null && !Array.isArray(doc)
    ? { schema: (doc as { schema?: unknown }).schema }
    : { problem: 'must be a mapping of keys to values' };
}

/**
 * Checks one contract file against the contract its `schema:` key names.
 *
 * @param text - the whole file, YAML or JSON
 * @returns the reader's errors and warnings; a file with no usable `schema:` key, or one for a contract this tool has no shape for, is an error
 */
export function checkContractFile(text: string): FileReport {
  const found = sniff(text);
  if (found.problem !== undefined) return { errors: [{ field: DOCUMENT, message: found.problem }], warnings: [] };
  const declared = typeof found.schema === 'string' ? found.schema : '';
  const name = /^([a-z0-9][a-z0-9-]*)\/v[1-9][0-9]*$/.exec(declared)?.[1];
  if (name === undefined) {
    return {
      errors: [{ field: 'schema', message: 'is required and must be <contract>/v<major>, for example component/v1' }],
      warnings: [],
    };
  }
  if (!Object.hasOwn(contractDefinitions, name)) {
    return {
      errors: [{ field: 'schema', message: `${name} is not a contract this tool has a file shape for` }],
      warnings: [],
    };
  }
  const read = readContract(declared, text);
  return { errors: read.errors, warnings: read.warnings };
}

/**
 * Chooses the check for a file by its name and text.
 *
 * @param file - the path as given, whose last part decides: `index.md` is the contracts index
 * @param text - the whole file
 * @returns what the check found
 */
export function checkFile(file: string, text: string): FileReport {
  return path.basename(file) === 'index.md' ? checkIndex(text) : checkContractFile(text);
}

/**
 * Writes the lines for one checked file: the warnings, the errors, and `ok` when there are no errors.
 *
 * @param file - the path as given, printed first on every line
 * @param report - what the check found
 * @returns the lines, each safe to print (control characters from the file are replaced)
 */
export function reportLines(file: string, report: FileReport): readonly string[] {
  const line = (level: string, finding: Finding): string =>
    oneLine(`${file}: ${level}: ${finding.field}: ${finding.message}`);
  const ok =
    report.errors.length === 0
      ? [oneLine(`${file}: ok${report.contracts === undefined ? '' : ` (${report.contracts} contracts)`}`)]
      : [];
  return [
    ...report.warnings.map((each) => line('warning', each)),
    ...report.errors.map((each) => line('error', each)),
    ...ok,
  ];
}

function readFile(file: string, cwd: string): { text: string } | { problem: string } {
  const absolute = path.resolve(cwd, file);
  try {
    if (fs.statSync(absolute).size > MAX_YAML_BYTES) return { problem: `is over the ${MAX_YAML_BYTES} byte limit` };
    return { text: fs.readFileSync(absolute, 'utf8') };
  } catch {
    return { problem: 'cannot be read' };
  }
}

/**
 * Runs the schema check for the files after the subcommand name.
 *
 * @param argv - the files to check; none is a usage error
 * @param env - the machine, whose working folder relative files resolve against
 * @returns the lines for every file and the exit code: 0 with no errors, 1 with any, 2 for a wrong command line
 */
export function runCheckSchemas(argv: readonly string[], env: ToolEnv): Outcome {
  if (argv.length === 0 || argv.some((arg) => arg.startsWith('-'))) {
    return failure(ExitCode.Usage, 'usage: check-schemas.ts <file>...  (a file named index.md is the contracts index)');
  }
  const lines: string[] = [];
  let failed = false;
  for (const file of argv) {
    const read = readFile(file, env.cwd);
    const report: FileReport =
      'text' in read
        ? checkFile(file, read.text)
        : { errors: [{ field: DOCUMENT, message: read.problem }], warnings: [] };
    failed ||= report.errors.length > 0;
    lines.push(...reportLines(file, report));
  }
  return { code: failed ? ExitCode.Failed : ExitCode.Ok, out: `${lines.join('\n')}\n`, err: '' };
}

if (import.meta.main) {
  const outcome = runCheckSchemas(process.argv.slice(2), realEnv());
  process.stdout.write(outcome.out);
  process.stderr.write(outcome.err);
  process.exitCode = outcome.code;
}
