// The acceptance-criterion coverage check (specs/022 T083; requirements: tests/coverage/coverage.feature, QB-1, QB-2).
// QB-1: every acceptance criterion (AC) of a delivered phase has a scenario whose title starts with its id.
// QB-2: an id that cannot be automated sits on the reviewed exemption list (tests/coverage/exemptions.yaml, ac-exemptions/v1)
// with a reason and the manual check that replaces it; the list is checked even for ids of phases not delivered yet.
//
// Usage: node scripts/check-ac-coverage.ts --delivered <phase list> [--root <dir>]
//   --delivered  the phases that are delivered, comma separated, for example 0 or 0,2
//   --root       the tree to check (default: the current folder)
// Exit codes: 0 pass, 1 a finding, 2 a usage error.
//
// What it reads:
//   <root>/specs/022-repo-split/spec.md   an AC is a numbered line `N. **AC-<story>.<n>** ...`; its phase is the "(Phase N)" of the
//                                         "### User Story" heading above it. An id of the spec is also an AC, an `**A-<n>**`
//                                         assumption, an `**EDGE-<n>**` edge case or a `| SC-<nnn> |` success criterion.
//   <root>/tests/**/*.feature             the scenario titles (folders named fixtures and node_modules are skipped)
//   <root>/tests/coverage/exemptions.yaml the exemption list
// An EDGE id has no phase in the spec, so it is never required by --delivered; it is a valid id for an exemption.
import fs from 'node:fs';
import path from 'node:path';
import { readYaml } from '#contracts/lib/yaml.ts';

const SPEC_FILE = 'specs/022-repo-split/spec.md';
const EXEMPTIONS_FILE = 'tests/coverage/exemptions.yaml';
const EXEMPTIONS_SCHEMA = 'ac-exemptions/v1';
const SKIPPED_FOLDERS: ReadonlySet<string> = new Set(['fixtures', 'node_modules', '.git']);
const EXIT_PASS = 0;
const EXIT_FINDING = 1;
const EXIT_USAGE = 2;

const STORY_HEADING = /^### User Story \d+\b.*\(Phase (\d+)\)\s*$/;
const AC_LINE = /^\s*\d+\.\s+\*\*(AC-\d+\.\d+)\*\*/;
const BOLD_ID = /\*\*((?:A|EDGE)-\d+)\*\*/g;
const TABLE_ID = /^\|\s*(SC-\d+)\s*\|/;
const SCENARIO_LINE = /^\s*(?:Scenario Outline|Scenario Template|Scenario|Example):\s*(.*)$/;

/** An acceptance criterion and the phase of its story. */
export interface Criterion {
  /** The id the atlas and the baseline use. */
  readonly id: string;
  /** The phase of its story. */
  readonly phase: number;
}

/** What the spec defines: the criteria with their phases, and every id an exemption may name. */
export interface SpecIds {
  /** The criteria with their phases. */
  readonly criteria: readonly Criterion[];
  /** Every defined id. */
  readonly known: ReadonlySet<string>;
}

/** One entry of the exemption list as written; a missing field is undefined. */
export interface Exemption {
  /** The id the atlas and the baseline use. */
  readonly id: string;
  /** Why it cannot be automated. */
  readonly reason: string | undefined;
  /** The manual check that stands in. */
  readonly replacement: string | undefined;
}

/** What a run reports: output lines and the exit code. */
export interface Outcome {
  /** The exit code. */
  readonly code: number;
  /** The output lines. */
  readonly lines: readonly string[];
}

/**
 * Finds the ids a line of the spec defines: an AC line, bold A- and EDGE- ids, or the id cell of a success-criterion row.
 *
 * @param line - one line of spec.md
 * @returns the ids defined on the line, none for prose that only mentions one
 */
function definedIds(line: string): readonly string[] {
  const ac = AC_LINE.exec(line)?.[1];
  const row = TABLE_ID.exec(line)?.[1];
  const bold = [...line.matchAll(BOLD_ID)].map((match) => match[1] ?? '');
  return [ac, row, ...bold].filter((id): id is string => id !== undefined && id !== '');
}

/**
 * Reads the ids out of the spec text.
 *
 * @param text - the contents of spec.md
 * @returns the acceptance criteria with the phase of their story, and the set of every defined id
 */
export function readSpecIds(text: string): SpecIds {
  const criteria: Criterion[] = [];
  const known = new Set<string>();
  let phase: number | undefined;
  for (const line of text.split('\n')) {
    const heading = STORY_HEADING.exec(line);
    if (heading !== null) phase = Number(heading[1]);
    else if (line.startsWith('### ')) phase = undefined;
    const criterion = AC_LINE.exec(line)?.[1];
    if (criterion !== undefined && phase !== undefined) criteria.push({ id: criterion, phase });
    for (const id of definedIds(line)) known.add(id);
  }
  return { criteria, known };
}

/**
 * The first word of every scenario title in a feature file.
 *
 * @param text - the contents of a `.feature` file
 * @returns the first word of each title, without a trailing colon or comma, so `AC-1.1` and `AC-1.10` stay different
 */
export function scenarioLeads(text: string): readonly string[] {
  const leads: string[] = [];
  for (const line of text.split('\n')) {
    const title = SCENARIO_LINE.exec(line)?.[1]?.trim();
    const first = title?.split(/\s+/)[0]?.replace(/[:,]+$/, '');
    if (first !== undefined && first !== '') leads.push(first);
  }
  return leads;
}

/**
 * The QB-2 findings for the exemption list.
 *
 * @param exemptions - the entries as written
 * @param known - every id the spec defines
 * @returns one line per problem, in list order
 */
export function exemptionFindings(exemptions: readonly Exemption[], known: ReadonlySet<string>): readonly string[] {
  const blank = (value: string | undefined): boolean => value === undefined || value.trim() === '';
  return exemptions.flatMap((entry) => [
    ...(known.has(entry.id) ? [] : [`QB-2 exemption ${entry.id} is not an id in spec.md`]),
    ...(blank(entry.reason) ? [`QB-2 exemption ${entry.id} has no reason`] : []),
    ...(blank(entry.replacement) ? [`QB-2 exemption ${entry.id} has no manual replacement`] : []),
  ]);
}

/**
 * Checks the criteria of the delivered phases against the scenario leads and the exemption list.
 *
 * @param criteria - every acceptance criterion with its phase
 * @param delivered - the delivered phases
 * @param leads - the first words of the scenario titles
 * @param exempt - the ids on the exemption list
 * @returns the QB-1 lines for uncovered ids, and how many delivered ids there are and how many are covered or exempt
 */
export function coverage(
  criteria: readonly Criterion[],
  delivered: ReadonlySet<number>,
  leads: ReadonlySet<string>,
  exempt: ReadonlySet<string>,
): { readonly findings: readonly string[]; readonly total: number; readonly covered: number } {
  const due = criteria.filter((c) => delivered.has(c.phase));
  const missing = due.filter((c) => !leads.has(c.id) && !exempt.has(c.id));
  return {
    findings: missing.map((c) => `QB-1 ${c.id} has no scenario (phase ${c.phase})`),
    total: due.length,
    covered: due.length - missing.length,
  };
}

function readEntry(raw: unknown): Exemption | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const entry = raw as Record<string, unknown>;
  const text = (value: unknown): string | undefined => (typeof value === 'string' ? value : undefined);
  const id = text(entry['id']);
  return id === undefined || id === ''
    ? null
    : { id, reason: text(entry['reason']), replacement: text(entry['replacement']) };
}

/**
 * Reads exemptions.yaml into entries, refusing a file without the ac-exemptions/v1 schema.
 *
 * @param text - the contents of exemptions.yaml, or null when the file does not exist (an empty list)
 * @returns the entries, or the QB-2 line that says why the file is refused
 */
export function readExemptions(text: string | null): {
  readonly entries: readonly Exemption[];
  readonly problem?: string;
} {
  if (text === null) return { entries: [] };
  const document = readYaml(text);
  if (!document.ok)
    return {
      entries: [],
      problem: `QB-2 ${EXEMPTIONS_FILE} cannot be read: ${document.findings[0]?.message ?? 'invalid'}`,
    };
  const root = document.value as Record<string, unknown> | null;
  const list = root?.['exemptions'];
  if (root?.['schema'] !== EXEMPTIONS_SCHEMA || !Array.isArray(list)) {
    return {
      entries: [],
      problem: `QB-2 ${EXEMPTIONS_FILE} must have schema: ${EXEMPTIONS_SCHEMA} and an exemptions list`,
    };
  }
  const entries = list.map(readEntry);
  if (entries.includes(null)) return { entries: [], problem: `QB-2 ${EXEMPTIONS_FILE}: every exemption needs an id` };
  return { entries: entries as Exemption[] };
}

function featureFiles(folder: string): string[] {
  if (!fs.existsSync(folder)) return [];
  return fs.readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(folder, entry.name);
    if (entry.isDirectory()) return SKIPPED_FOLDERS.has(entry.name) ? [] : featureFiles(full);
    return entry.isFile() && entry.name.endsWith('.feature') ? [full] : [];
  });
}

/**
 * Runs the check on a tree.
 *
 * @param root - the tree to check
 * @param delivered - the delivered phases
 * @returns the lines to print and the exit code
 */
export function run(root: string, delivered: ReadonlySet<number>): Outcome {
  const specFile = path.join(root, SPEC_FILE);
  if (!fs.existsSync(specFile)) return { code: EXIT_FINDING, lines: [`check-ac-coverage: spec missing: ${SPEC_FILE}`] };
  const spec = readSpecIds(fs.readFileSync(specFile, 'utf8'));
  const exemptionsFile = path.join(root, EXEMPTIONS_FILE);
  const read = readExemptions(fs.existsSync(exemptionsFile) ? fs.readFileSync(exemptionsFile, 'utf8') : null);
  const leads = new Set(
    featureFiles(path.join(root, 'tests')).flatMap((f) => scenarioLeads(fs.readFileSync(f, 'utf8'))),
  );
  const exempt = new Set(read.entries.map((e) => e.id));
  const result = coverage(spec.criteria, delivered, leads, exempt);
  const lines = [
    ...result.findings,
    ...(read.problem === undefined ? exemptionFindings(read.entries, spec.known) : [read.problem]),
  ];
  if (lines.length > 0) return { code: EXIT_FINDING, lines };
  return {
    code: EXIT_PASS,
    lines: [`check-ac-coverage: ${result.covered} of ${result.total} delivered ids covered or exempt`],
  };
}

/**
 * Reads the `--delivered` value.
 *
 * @param list - comma-separated phase numbers, for example `0,2`
 * @returns the phases as a set, or null when an item is not a whole number
 */
function parsePhases(list: string): ReadonlySet<number> | null {
  const items = list.split(',').map((item) => item.trim());
  return items.every((item) => /^\d+$/.test(item)) ? new Set(items.map(Number)) : null;
}

/**
 * Reads the command line.
 *
 * @param argv - the arguments after the script name
 * @returns the root and the delivered phases, or null for a usage error
 */
function parseArguments(
  argv: readonly string[],
): { readonly root: string; readonly delivered: ReadonlySet<number> } | null {
  let root = process.cwd();
  let delivered: ReadonlySet<number> | null = null;
  for (let i = 0; i < argv.length; i += 2) {
    const value = argv[i + 1];
    if (value === undefined || value.startsWith('--')) return null;
    if (argv[i] === '--root') root = path.resolve(value);
    else if (argv[i] === '--delivered') delivered = parsePhases(value);
    else return null;
  }
  return delivered === null ? null : { root, delivered };
}

if (import.meta.main) {
  const options = parseArguments(process.argv.slice(2));
  if (options === null) {
    process.stderr.write(
      'Usage: node scripts/check-ac-coverage.ts --delivered <phase list, for example 0,2> [--root <dir>]\n',
    );
    process.exitCode = EXIT_USAGE;
  } else {
    const outcome = run(options.root, options.delivered);
    process.stdout.write(`${outcome.lines.join('\n')}\n`);
    process.exitCode = outcome.code;
  }
}
