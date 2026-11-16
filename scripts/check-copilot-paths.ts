// The sorting check of the hard-coded Copilot home paths (specs/022 T149; requirements: tests/installer-compat/sorting.feature,
// AC-8.4, AC-8.5, FR-032; message MG-40 of specs/022-repo-split/contracts/installer-cli.md).
//
// Every line that names the Copilot home folder (a tilde, then `/.copilot`) is one of two classes:
//   copilot-own  every such path on the line lies under an entry of `own:` in the record (a folder or file Copilot itself owns);
//   agent-home   any other line, also a line that names an own path and another path (it will become `{{AGENT_HOME}}`).
// A line with `{{AGENT_HOME}}` and no Copilot home path is not counted. The record `scripts/copilot-paths.yaml` holds the
// allow-list, the method and date of the measurement, and the agent-home lines per file; a file whose agent-home count is
// above its recorded count has new lines and the check fails. A count below the record passes; lowering the record is a human edit.
// This file and its tests never write the folder name in full (they build it), so the check does not count itself.
//
// Usage: node scripts/check-copilot-paths.ts [--list] [--root <folder>]
//   --root  the tree to check (default: the current folder); its tracked files when it is a git work tree, else every file under it
//   --list  also print one `<class> <file>:<line>` line per classified line, sorted by file and line
// Exit codes: 0 pass, 1 a new agent-home line or an unusable record, 2 a usage error.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { readYaml } from '#contracts/lib/yaml.ts';

/** The record file, relative to the root; it is not scanned. */
export const RECORD_FILE = 'scripts/copilot-paths.yaml';

const HOME_PATH = ['~', '.copilot'].join('/');
const RECORD_SCHEMA = 'copilot-paths/v1';
const SKIPPED_FOLDERS: ReadonlySet<string> = new Set(['node_modules', '.git']);
const EXIT_PASS = 0;
const EXIT_FINDING = 1;
const EXIT_USAGE = 2;

/** The two classes of a line that names the Copilot home folder. */
export type LineClass = 'agent-home' | 'copilot-own';

/** One classified line. */
export interface ClassifiedLine {
  /** The file, relative to the root, with `/` separators. */
  readonly file: string;
  /** The line number, counted from 1. */
  readonly line: number;
  /** The class of the line. */
  readonly kind: LineClass;
  /** The text of the line. */
  readonly text: string;
}

/** A file read from the tree. */
export interface SourceFile {
  /** The path relative to the root, with `/` separators. */
  readonly path: string;
  /** The file contents. */
  readonly text: string;
}

/** The record file, read. */
export interface PathRecord {
  /** The paths Copilot owns, each as written in the record (the home path followed by the entry). */
  readonly own: readonly string[];
  /** The recorded agent-home line count per file. */
  readonly agentHomeLines: Readonly<Record<string, number>>;
}

/** The result of comparing the classified lines with the record. */
export interface Report {
  /** Every classified line, sorted by file and line. */
  readonly lines: readonly ClassifiedLine[];
  /** The agent-home lines that exceed the record, sorted by file and line. */
  readonly newLines: readonly ClassifiedLine[];
  /** The number of files that hold at least one classified line. */
  readonly files: number;
  /** The sum of the recorded agent-home counts. */
  readonly baseline: number;
}

/** A value or the problems that stop it (an expected failure is a value). */
export type Parsed<T> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly problems: readonly string[] };

/** What a run reports: output lines and the exit code. */
export interface Outcome {
  /** The exit code. */
  readonly code: number;
  /** The output lines. */
  readonly lines: readonly string[];
}

const isNameCharacter = (character: string | undefined): boolean =>
  character !== undefined && /[A-Za-z0-9_-]/.test(character);

/**
 * Tells whether the text after a home path continues the same name, so an own entry does not match a longer name.
 *
 * @param rest - the text right after the matched entry
 * @returns true when the entry is only the start of a longer name
 */
function continuesName(rest: string): boolean {
  return isNameCharacter(rest[0]) || (rest[0] === '.' && isNameCharacter(rest[1]));
}

/**
 * Lists the text after each Copilot home path on a line.
 *
 * @param line - one line of text
 * @returns the rest of the line after each occurrence (a longer name such as `...-x` is not an occurrence)
 */
function pathTails(line: string): readonly string[] {
  const tails: string[] = [];
  for (let at = line.indexOf(HOME_PATH); at !== -1; at = line.indexOf(HOME_PATH, at + HOME_PATH.length)) {
    const tail = line.slice(at + HOME_PATH.length);
    if (!isNameCharacter(tail[0])) tails.push(tail);
  }
  return tails;
}

/**
 * Tells whether a line is an own path, an agent-home path, or names neither.
 *
 * @param line - one line of text
 * @param own - the own entries, each written with the home path in front
 * @returns null when the line names no Copilot home path; copilot-own when every path lies under an own entry; else agent-home
 */
export function classifyLine(line: string, own: readonly string[]): LineClass | null {
  const tails = pathTails(line);
  if (tails.length === 0) return null;
  const suffixes = own.filter((entry) => entry.startsWith(HOME_PATH)).map((entry) => entry.slice(HOME_PATH.length));
  const isOwn = (tail: string): boolean =>
    suffixes.some((suffix) => tail.startsWith(suffix) && !continuesName(tail.slice(suffix.length)));
  return tails.every(isOwn) ? 'copilot-own' : 'agent-home';
}

/**
 * Classifies every line of the files, skipping the record file.
 *
 * @param files - the files read from the tree
 * @param own - the own entries
 * @returns the classified lines, sorted by file and line
 */
export function classifyFiles(files: readonly SourceFile[], own: readonly string[]): readonly ClassifiedLine[] {
  return files
    .filter((file) => file.path !== RECORD_FILE)
    .flatMap((file) =>
      file.text.split(/\r?\n/).flatMap((text, index) => {
        const kind = classifyLine(text, own);
        return kind === null ? [] : [{ file: file.path, line: index + 1, kind, text }];
      }),
    )
    .sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : a.line - b.line));
}

/**
 * Compares the classified lines with the record.
 *
 * For a file with more agent-home lines than recorded, the new lines are taken to be the last ones of the file, as many as the excess.
 *
 * @param lines - the classified lines, sorted by file and line
 * @param record - the allow-list and the recorded counts
 * @returns the lines, the new agent-home lines, the file count and the recorded baseline
 */
export function buildReport(lines: readonly ClassifiedLine[], record: PathRecord): Report {
  const agentHome = lines.filter((l) => l.kind === 'agent-home');
  const byFile = Map.groupBy(agentHome, (l) => l.file);
  const newLines = [...byFile.entries()].flatMap(([file, found]) => {
    const excess = found.length - (record.agentHomeLines[file] ?? 0);
    return excess > 0 ? found.slice(found.length - excess) : [];
  });
  return {
    lines,
    newLines,
    files: new Set(lines.map((l) => l.file)).size,
    baseline: Object.values(record.agentHomeLines).reduce((sum, count) => sum + count, 0),
  };
}

/**
 * Writes the report as the lines MG-40 fixes.
 *
 * @param report - the comparison
 * @param list - true to put the class of every line before the totals
 * @returns the output lines: new lines first, then the listing when asked, then the totals
 */
export function renderReport(report: Report, list: boolean): readonly string[] {
  const agentHome = report.lines.filter((l) => l.kind === 'agent-home').length;
  return [
    ...report.newLines.map((l) => `new agent-home line: ${l.file}:${l.line}: ${l.text}`),
    ...(list ? report.lines.map((l) => `${l.kind} ${l.file}:${l.line}`) : []),
    `copilot paths: ${report.lines.length} lines in ${report.files} files (agent-home ${agentHome}, copilot-own ${report.lines.length - agentHome}), baseline agent-home ${report.baseline}`,
  ];
}

const isRecordObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Parses scripts/copilot-paths.yaml and rejects a wrong schema, an own entry outside the home folder, or a bad count.
 *
 * @param text - the contents of scripts/copilot-paths.yaml
 * @returns the allow-list and the recorded counts, or the problems found
 */
export function readRecord(text: string): Parsed<PathRecord> {
  const document = readYaml(text);
  if (!document.ok) return { ok: false, problems: document.findings.map((f) => `${RECORD_FILE}: ${f.message}`) };
  const root = document.value;
  if (!isRecordObject(root) || root['schema'] !== RECORD_SCHEMA)
    return { ok: false, problems: [`${RECORD_FILE}: schema must be ${RECORD_SCHEMA}`] };
  const own = root['own'];
  if (!Array.isArray(own) || !own.every((e) => typeof e === 'string' && e.startsWith(`${HOME_PATH}/`)))
    return {
      ok: false,
      problems: [`${RECORD_FILE}: own must be a list of paths that start with the Copilot home folder`],
    };
  const counts = root['agent-home-lines'];
  const valid = isRecordObject(counts) && Object.values(counts).every((n) => Number.isInteger(n) && (n as number) >= 0);
  if (!valid) return { ok: false, problems: [`${RECORD_FILE}: agent-home-lines must map each file to a count`] };
  return { ok: true, value: { own: own as string[], agentHomeLines: counts as Record<string, number> } };
}

/**
 * Lists the files of a tree: its tracked files when it is a git work tree, else every file under it.
 *
 * @param root - the tree
 * @returns the paths relative to the root, with `/` separators, sorted
 */
function listFiles(root: string): readonly string[] {
  if (fs.existsSync(path.join(root, '.git'))) {
    const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')));
    const out = execFileSync('git', ['ls-files', '-z', '--'], { cwd: root, env, encoding: 'utf8', maxBuffer: 1 << 28 });
    return out
      .split('\0')
      .filter((p) => p !== '')
      .sort();
  }
  const walk = (dir: string): string[] =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return SKIPPED_FOLDERS.has(entry.name) ? [] : walk(full);
      return entry.isFile() ? [path.relative(root, full).split(path.sep).join('/')] : [];
    });
  return walk(root).sort();
}

/**
 * Reads the text files of a tree; a link, a missing file (deleted in the work tree) and a binary file are skipped.
 *
 * @param root - the folder whose files are scanned
 * @returns the path and text of each readable file
 */
function readFiles(root: string): readonly SourceFile[] {
  return listFiles(root).flatMap((relative) => {
    const full = path.join(root, relative);
    if (!fs.lstatSync(full, { throwIfNoEntry: false })?.isFile()) return [];
    const text = fs.readFileSync(full, 'utf8');
    return text.includes('\0') ? [] : [{ path: relative, text }];
  });
}

/**
 * Runs the check on a tree.
 *
 * @param root - the tree to check
 * @param list - true to print the class of every line
 * @returns the lines to print and the exit code
 */
export function run(root: string, list: boolean): Outcome {
  const recordPath = path.join(root, RECORD_FILE);
  if (!fs.existsSync(recordPath)) return { code: EXIT_FINDING, lines: [`error: ${RECORD_FILE} is missing`] };
  const record = readRecord(fs.readFileSync(recordPath, 'utf8'));
  if (!record.ok) return { code: EXIT_FINDING, lines: record.problems.map((p) => `error: ${p}`) };
  const report = buildReport(classifyFiles(readFiles(root), record.value.own), record.value);
  return { code: report.newLines.length === 0 ? EXIT_PASS : EXIT_FINDING, lines: renderReport(report, list) };
}

/**
 * Reads the command line.
 *
 * @param argv - the arguments after the script name
 * @returns the root and the `--list` choice, or null for a usage error
 */
function parseArguments(argv: readonly string[]): { readonly root: string; readonly list: boolean } | null {
  let root = process.cwd();
  let list = false;
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (flag === '--list') list = true;
    else if (flag === '--root' && value !== undefined && !value.startsWith('--')) {
      root = path.resolve(value);
      i += 1;
    } else return null;
  }
  return { root, list };
}

if (import.meta.main) {
  const options = parseArguments(process.argv.slice(2));
  if (options === null) {
    process.stderr.write('Usage: node scripts/check-copilot-paths.ts [--list] [--root <folder>]\n');
    process.exitCode = EXIT_USAGE;
  } else {
    const outcome = run(options.root, options.list);
    process.stdout.write(`${outcome.lines.join('\n')}\n`);
    process.exitCode = outcome.code;
  }
}
