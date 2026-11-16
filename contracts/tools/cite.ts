// The `cite` subcommand of build.ts (specs/022 T100, FR-017, FR-044, AC-9.5 to AC-9.7, AC-5.10, EDGE-7, EDGE-13; DR-401 to DR-418).
// A consumer's Markdown cites another component's file as a link whose text starts with {{AGENT_HOME}}/. This tool gives each such
// link the GitHub address of the cited file in the provider's repository and keeps `depends.slots[].docs` equal to the cited files.
// Pure core (what the files hold in, findings and new file texts out) and the edge that reads the folder and writes the changes.
// The command line, the messages and the last lines are pinned by tests/build-cite/cite.feature.
import fs from 'node:fs';
import path from 'node:path';
import {
  AGENT_HOME_PLACEHOLDER,
  classifyCitation,
  locationRulesFromSlots,
  type Citation,
  type LocationRule,
} from '#contracts/lib/citations.ts';
import { readContract } from '#contracts/lib/reader.ts';
import { readYaml } from '#contracts/lib/yaml.ts';
import { ExitCode, fail, failure, oneLine, succeed, type Outcome, type Result, type ToolEnv } from './tool-io.ts';

const PREFIX = `${AGENT_HOME_PLACEHOLDER}/`;
const BRANCH = 'main';

/** A provider component, as far as a target needs it. */
export interface Provider {
  /** The component.yaml path as it was given on the command line, for messages. */
  readonly file: string;
  /** The component's `name`. */
  readonly name: string;
  /** The slot it fills. */
  readonly slot: string;
  /** Its `repository`, absent for a repository never pushed (EDGE-13). */
  readonly repository: string | undefined;
  /** Location name to folder relative to the repository root. */
  readonly locations: Readonly<Record<string, string>>;
}

/** A Markdown file of the consumer, with a path relative to the root and `/` separators. */
export interface SourceFile {
  /** The path relative to the root, with `/` separators. */
  readonly path: string;
  /** The whole text of the file. */
  readonly text: string;
}

/** One `depends.slots` entry of the consumer's component.yaml: the slot and the docs it lists now. */
export interface DependsEntry {
  /** The slot the entry names. */
  readonly slot: string;
  /** The cited files it lists, as written. */
  readonly docs: readonly string[];
}

/** The consumer's component.yaml, the text for a minimal edit and the parsed entries for the comparison. */
export interface ConsumerComponent {
  /** The file as written. */
  readonly text: string;
  /** The `depends.slots` entries. */
  readonly entries: readonly DependsEntry[];
}

/** Everything the plan reads. */
export interface CiteInput {
  /** The slot locations to classify against. */
  readonly rules: readonly LocationRule[];
  /** The `--provider` components. */
  readonly providers: readonly Provider[];
  /** The Markdown files below the root, in path order. */
  readonly files: readonly SourceFile[];
  /** The consumer's component.yaml, absent when it has none. */
  readonly component: ConsumerComponent | undefined;
}

/** A file whose text the plan changes. */
export interface FileChange {
  /** The path relative to the root. */
  readonly path: string;
  /** The whole new text. */
  readonly text: string;
}

/** What one run found and would write. */
export interface CitePlan {
  /** The messages to print, in order. */
  readonly findings: readonly string[];
  /** The citations of another component that were classified. */
  readonly citations: number;
  /** The new texts, only with `write`; empty otherwise. */
  readonly changes: readonly FileChange[];
  /** The targets and docs lists the changes fix. */
  readonly written: number;
}

// ---- the plan: pure -----------------------------------------------------------------------------------------------

interface Link {
  readonly text: string;
  readonly target: string;
  readonly targetStart: number;
}

type LocationCitation = Extract<Citation, { kind: 'location' }>;

interface Cited {
  readonly link: Link;
  readonly citation: LocationCitation;
}

interface Edit {
  readonly start: number;
  readonly end: number;
  readonly replacement: string;
}

// `[text](target)`, not an image; one level of parentheses is allowed in the target, because encodeURIComponent leaves ( and ).
const LINK = /(?<!!)\[([^\]\n]*)\]\(((?:[^()\n]|\([^()\n]*\))*)\)/g;

function linksOf(text: string): readonly Link[] {
  return [...text.matchAll(LINK)].map((found) => {
    const linkText = found[1] ?? '';
    return { text: linkText, target: found[2] ?? '', targetStart: found.index + 1 + linkText.length + 2 };
  });
}

function encodePath(folder: string, rest: string): string {
  const segments = [...(folder === '.' ? [] : folder.split('/')), ...(rest === '' ? [] : rest.split('/'))];
  return segments.map(encodeURIComponent).join('/');
}

function providerOf(citation: LocationCitation, providers: readonly Provider[]): Provider | undefined {
  // A mount with {component} is filled by the component of that name (slots.yaml), so the name picks the provider.
  return providers.find(
    (provider) =>
      provider.slot === citation.slot && (citation.component === undefined || provider.name === citation.component),
  );
}

// The target of a citation, or the sentence that says why there is none.
function expectedTarget(citation: LocationCitation, providers: readonly Provider[]): Result<string> {
  const provider = providerOf(citation, providers);
  if (provider === undefined) {
    const named = citation.component === undefined ? '' : ` as ${citation.component}`;
    return fail(`no --provider fills slot ${citation.slot}${named}`);
  }
  if (provider.repository === undefined) {
    return fail(`provider ${provider.name} has no repository (${provider.file})`);
  }
  const folder = provider.locations[citation.location];
  if (folder === undefined) {
    return fail(`provider ${provider.name} has no location ${citation.location} (${provider.file})`);
  }
  return succeed(`${provider.repository.replace(/\/+$/, '')}/blob/${BRANCH}/${encodePath(folder, citation.path)}`);
}

function applyEdits(text: string, edits: readonly Edit[]): string {
  const ordered = [...edits].sort((left, right) => left.start - right.start);
  const pieces = ordered.reduce<{ readonly parts: readonly string[]; readonly at: number }>(
    (state, edit) => ({ parts: [...state.parts, text.slice(state.at, edit.start), edit.replacement], at: edit.end }),
    { parts: [], at: 0 },
  );
  return [...pieces.parts, text.slice(pieces.at)].join('');
}

interface FileResult {
  readonly cited: readonly Cited[];
  readonly findings: readonly string[];
  readonly edits: readonly Edit[];
}

// One finding or one edit for a citation whose target is known.
function judge(file: string, cited: Cited, expected: string, write: boolean): { finding?: string; edit?: Edit } {
  const { link } = cited;
  if (link.target === expected) return {};
  if (write) {
    return { edit: { start: link.targetStart, end: link.targetStart + link.target.length, replacement: expected } };
  }
  const was = link.target === '' ? 'has no target' : `has target ${oneLine(link.target)}`;
  return { finding: `${file}: error: citation "${oneLine(link.text)}" ${was}, expected ${expected}` };
}

function analyseFile(file: SourceFile, input: CiteInput, write: boolean): FileResult {
  const classified = linksOf(file.text)
    .filter((link) => link.text.startsWith(PREFIX))
    .map((link) => ({ link, result: classifyCitation(link.text, input.rules) }));
  const cited: Cited[] = [];
  const findings: string[] = [];
  const edits: Edit[] = [];
  for (const { link, result } of classified) {
    const prefix = `${file.path}: error: citation "${oneLine(link.text)}"`;
    if (!result.ok) {
      findings.push(`${prefix}: ${oneLine(result.failure.message)}`);
    } else if (result.citation.kind === 'location') {
      const one = { link, citation: result.citation };
      cited.push(one);
      const expected = expectedTarget(one.citation, input.providers);
      if (!expected.ok) {
        findings.push(`${prefix}: ${expected.message}`);
      } else {
        const verdict = judge(file.path, one, expected.value, write);
        if (verdict.finding !== undefined) findings.push(verdict.finding);
        if (verdict.edit !== undefined) edits.push(verdict.edit);
      }
    }
  }
  return { cited, findings, edits };
}

// ---- depends.docs ---------------------------------------------------------------------------------------------------

function generatedDocs(cited: readonly Cited[], slot: string): readonly string[] {
  const texts = cited.filter((one) => one.citation.slot === slot).map((one) => one.link.text.slice(PREFIX.length));
  // Code unit order, never a locale's, so the generated list is the same on every machine.
  return [...new Set(texts)].sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
}

function flowItem(doc: string): string {
  return /^[^\s,[\]{}#:'"&*!|>%@`?-][^,[\]{}#:'"]*$/.test(doc) && doc === doc.trim() ? doc : JSON.stringify(doc);
}

function flowList(docs: readonly string[]): string {
  return `[${docs.map(flowItem).join(', ')}]`;
}

function indentOf(line: string): number {
  return line.length - line.trimStart().length;
}

interface EntryPlace {
  /** Index of the `- slot:` line. */
  readonly head: number;
  /** Column of the entry's keys. */
  readonly keyIndent: number;
  /** Index of the entry's `docs:` line, -1 when it has none. */
  readonly docsAt: number;
}

function locateEntry(lines: readonly string[], slot: string): EntryPlace | undefined {
  const head = lines.findIndex(
    (line) => /^(\s*)-(\s+)slot:\s*(["']?)([^"'\s#]+)\3\s*(#.*)?\r?$/.exec(line)?.[4] === slot,
  );
  const headLine = lines[head];
  if (headLine === undefined) return undefined;
  const keyIndent = headLine.indexOf('slot:');
  const entryEnd = lines.findIndex(
    (line, index) => index > head && line.trim() !== '' && !line.trim().startsWith('#') && indentOf(line) < keyIndent,
  );
  const last = entryEnd === -1 ? lines.length : entryEnd;
  const docsAt = lines.findIndex(
    (line, index) =>
      index > head && index < last && indentOf(line) === keyIndent && line.trimStart().startsWith('docs:'),
  );
  return { head, keyIndent, docsAt };
}

// The new `docs:` line for an old one that is a one-line flow list or empty; undefined for any other layout.
function replacementLine(old: string, next: string, keyIndent: number, docs: readonly string[]): string | undefined {
  const flow = /^\s*docs:\s*\[[^\]]*\](.*)$/.exec(old);
  const empty = /^\s*docs:\s*(#.*)?$/.test(old);
  const blockList = empty && next.trimStart().startsWith('- ') && indentOf(next) >= keyIndent;
  if (blockList || (flow === null && !empty)) return undefined;
  const comment = /(#.*)$/.exec(old)?.[1];
  const tail = flow === null ? (comment === undefined ? '' : ` ${comment}`) : (flow[1] ?? '');
  return `${' '.repeat(keyIndent)}docs: ${flowList(docs)}${tail}`;
}

// The line to write for the entry's docs, or undefined when the entry's layout is not one this tool edits.
function docsLineFor(lines: readonly string[], place: EntryPlace, docs: readonly string[]): string | undefined {
  if (place.docsAt === -1) return `${' '.repeat(place.keyIndent)}docs: ${flowList(docs)}`;
  const old = (lines[place.docsAt] ?? '').replace(/\r$/, '');
  return replacementLine(old, lines[place.docsAt + 1] ?? '', place.keyIndent, docs);
}

// Rewrites only the docs value of the entry for `slot`, so comments and layout around it stay as written.
function rewriteDocs(text: string, slot: string, docs: readonly string[]): Result<string> {
  const lines = text.split('\n');
  const place = locateEntry(lines, slot);
  const line = place === undefined ? undefined : docsLineFor(lines, place, docs);
  if (place === undefined || line === undefined) {
    return fail(`depends.slots ${slot}: cannot rewrite docs in this layout; write docs: ${flowList(docs)} by hand`);
  }
  const eol = (lines[place.head] ?? '').endsWith('\r') ? '\r' : '';
  const [from, count] = place.docsAt === -1 ? [place.head + 1, 0] : [place.docsAt, 1];
  return succeed([...lines.slice(0, from), `${line}${eol}`, ...lines.slice(from + count)].join('\n'));
}

function sameList(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((item, index) => item === right[index]);
}

interface DocsResult {
  readonly findings: readonly string[];
  readonly text: string | undefined;
  readonly written: number;
}

function checkDocs(component: ConsumerComponent, cited: readonly Cited[], write: boolean): DocsResult {
  return component.entries.reduce<DocsResult>(
    (state, entry) => {
      const generated = generatedDocs(cited, entry.slot);
      if (sameList(entry.docs, generated)) return state;
      if (!write) {
        const message = `depends.slots ${entry.slot} docs is [${entry.docs.join(', ')}], generated value is [${generated.join(', ')}]`;
        return { ...state, findings: [...state.findings, `component.yaml: error: ${message}`] };
      }
      const rewritten = rewriteDocs(state.text ?? component.text, entry.slot, generated);
      return rewritten.ok
        ? { findings: state.findings, text: rewritten.value, written: state.written + 1 }
        : { ...state, findings: [...state.findings, `component.yaml: error: ${rewritten.message}`] };
    },
    { findings: [], text: undefined, written: 0 },
  );
}

/**
 * Plans what `cite` reports and, with `write`, what it changes: no file is read or written here.
 *
 * @param input - the classification rules, the providers, the Markdown files in path order and the consumer's component.yaml
 * @param write - whether missing and stale targets and docs lists are fixed instead of reported
 * @returns the findings in file order (then component.yaml), the number of citations and, with `write`, the new file texts
 */
export function planCite(input: CiteInput, write: boolean): CitePlan {
  const results = input.files.map((file) => ({ file, result: analyseFile(file, input, write) }));
  const cited = results.flatMap(({ result }) => result.cited);
  const docs = input.component === undefined ? undefined : checkDocs(input.component, cited, write);
  const fileChanges = results
    .filter(({ result }) => result.edits.length > 0)
    .map(({ file, result }) => ({
      path: file.path,
      text: applyEdits(file.text, result.edits),
      edits: result.edits.length,
    }));
  const docsChange = docs?.text === undefined ? [] : [{ path: 'component.yaml', text: docs.text, edits: docs.written }];
  const changes = write ? [...fileChanges, ...docsChange] : [];
  return {
    findings: [...results.flatMap(({ result }) => result.findings), ...(docs?.findings ?? [])],
    citations: cited.length,
    changes: changes.map(({ path: changed, text }) => ({ path: changed, text })),
    written: changes.reduce((sum, change) => sum + change.edits, 0),
  };
}

/**
 * Words the plan the way the scenarios pin it.
 *
 * @param findings - every finding, in the order to print
 * @param plan - the plan the findings belong to
 * @param write - whether the run was a write run
 * @returns a line per finding and `cite: <n> findings` with exit 1; otherwise `cite: <n> citations ok`, with `, <m> written` after a write
 */
export function formatCite(findings: readonly string[], plan: CitePlan, write: boolean): Outcome {
  if (findings.length > 0) {
    return {
      code: ExitCode.Failed,
      out: `${[...findings, `cite: ${findings.length} findings`].join('\n')}\n`,
      err: '',
    };
  }
  const written = write ? `, ${plan.written} written` : '';
  return { code: ExitCode.Ok, out: `cite: ${plan.citations} citations ok${written}\n`, err: '' };
}

// ---- the edge: command line, files ------------------------------------------------------------------------------------

interface CiteArgs {
  readonly write: boolean;
  readonly root: string;
  readonly slots: string | undefined;
  readonly providers: readonly string[];
}

const VALUE_FLAGS: readonly string[] = ['--root', '--slots', '--provider'];

function withValue(acc: CiteArgs, name: string, value: string): CiteArgs {
  if (name === '--root') return { ...acc, root: value };
  if (name === '--slots') return { ...acc, slots: value };
  return { ...acc, providers: [...acc.providers, value] };
}

function parseValueFlag(name: string, flag: string, tail: readonly string[], acc: CiteArgs): Result<CiteArgs> {
  const inline = name === flag ? undefined : flag.slice(name.length + 1);
  const value = inline ?? tail[0];
  if (value === undefined) return fail(`build.ts cite: option ${name} needs a value`);
  return parseFrom(inline === undefined ? tail.slice(1) : tail, withValue(acc, name, value));
}

function parseFrom(rest: readonly string[], acc: CiteArgs): Result<CiteArgs> {
  const [flag, ...tail] = rest;
  if (flag === undefined) return succeed(acc);
  if (flag === '--write') return parseFrom(tail, { ...acc, write: true });
  const equals = flag.indexOf('=');
  const name = flag.startsWith('--') && equals > 0 ? flag.slice(0, equals) : flag;
  if (VALUE_FLAGS.includes(name)) return parseValueFlag(name, flag, tail, acc);
  return fail(
    flag.startsWith('-') ? `build.ts cite: unknown option ${flag}` : `build.ts cite: unexpected argument ${flag}`,
  );
}

function parseCiteArgs(argv: readonly string[], env: ToolEnv): Result<CiteArgs> {
  const parsed = parseFrom(argv, { write: false, root: env.cwd, slots: undefined, providers: [] });
  if (!parsed.ok) return parsed;
  if (parsed.value.slots === undefined) return fail('build.ts cite: --slots is required');
  if (parsed.value.providers.length === 0) return fail('build.ts cite: at least one --provider is required');
  return succeed({ ...parsed.value, root: path.resolve(env.cwd, parsed.value.root) });
}

function readText(absolute: string): string | undefined {
  try {
    return fs.readFileSync(absolute, 'utf8');
  } catch {
    return undefined;
  }
}

function mappingOf(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function stringOf(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

// Every .md file below the root, as paths with `/`, in path order; links are not followed, node_modules and .git are skipped.
function markdownFiles(root: string, relative = ''): readonly string[] {
  const entries = fs.readdirSync(path.join(root, relative), { withFileTypes: true });
  return entries
    .flatMap((entry) => {
      const here = relative === '' ? entry.name : `${relative}/${entry.name}`;
      if (entry.isDirectory())
        return entry.name === 'node_modules' || entry.name === '.git' ? [] : markdownFiles(root, here);
      return entry.isFile() && entry.name.endsWith('.md') ? [here] : [];
    })
    .sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
}

interface Loaded<T> {
  readonly value: T;
  readonly findings: readonly string[];
}

function readerFindings(given: string, id: string, text: string, skipField?: string): readonly string[] {
  return readContract(id, text)
    .errors.filter((error) => error.field !== skipField)
    .map((error) => `${given}: error: ${error.field}: ${error.message}`);
}

function loadRules(root: string, given: string): Loaded<readonly LocationRule[]> {
  const text = readText(path.resolve(root, given));
  if (text === undefined) return { value: [], findings: [`${given}: error: cannot read the file`] };
  const read = readYaml(text);
  return {
    value: read.ok ? locationRulesFromSlots(read.value) : [],
    findings: readerFindings(given, 'slots/v1', text),
  };
}

function loadProvider(root: string, given: string): Loaded<Provider | undefined> {
  const text = readText(path.resolve(root, given));
  if (text === undefined) return { value: undefined, findings: [`${given}: error: cannot read the file`] };
  const read = readYaml(text);
  const doc = read.ok ? mappingOf(read.value) : {};
  const name = stringOf(doc['name']);
  const slot = stringOf(doc['slot']);
  const repository = stringOf(doc['repository']);
  // A missing repository is reported where a citation needs it (AC-9.7), not here, so a provider nobody cites can lack one.
  const findings = readerFindings(given, 'component/v1', text, repository === undefined ? 'repository' : undefined);
  const locations = Object.fromEntries(
    Object.entries(mappingOf(doc['locations'])).flatMap(([key, folder]) =>
      typeof folder === 'string' ? [[key, folder]] : [],
    ),
  );
  return {
    value: name === undefined || slot === undefined ? undefined : { file: given, name, slot, repository, locations },
    findings,
  };
}

function loadConsumer(root: string): Loaded<ConsumerComponent | undefined> {
  const text = readText(path.join(root, 'component.yaml'));
  if (text === undefined) return { value: undefined, findings: [] };
  const read = readYaml(text);
  const slots = read.ok ? mappingOf(mappingOf(read.value)['depends'])['slots'] : undefined;
  const entries = (Array.isArray(slots) ? (slots as unknown[]) : []).flatMap((item) => {
    const entry = mappingOf(item);
    const slot = stringOf(entry['slot']);
    const docs = Array.isArray(entry['docs']) ? (entry['docs'] as unknown[]).map(String) : [];
    return slot === undefined ? [] : [{ slot, docs }];
  });
  return { value: { text, entries }, findings: readerFindings('component.yaml', 'component/v1', text, 'repository') };
}

function writeChanges(root: string, changes: readonly FileChange[]): void {
  for (const change of changes) fs.writeFileSync(path.join(root, change.path), change.text);
}

/**
 * Runs `cite` for the arguments after the subcommand name.
 *
 * @param argv - `[--write] --root <dir> --slots <slots.yaml> --provider <component.yaml> [--provider ...]`
 * @param env - the machine and the moment; only the working folder is used
 * @returns the findings and the summary line: exit 0 when every citation is right, 1 on a finding, 2 for a wrong command line
 */
export function runCite(argv: readonly string[], env: ToolEnv): Outcome {
  const args = parseCiteArgs(argv, env);
  if (!args.ok) return failure(ExitCode.Usage, args.message);
  const { root, write, slots, providers } = args.value;
  if (!fs.existsSync(root)) return failure(ExitCode.Usage, `build.ts cite: --root ${oneLine(root)} is not a folder`);
  const rules = loadRules(root, slots ?? '');
  const loadedProviders = providers.map((given) => loadProvider(root, given));
  const consumer = loadConsumer(root);
  const files = markdownFiles(root).map((name) => ({ path: name, text: readText(path.join(root, name)) ?? '' }));
  const plan = planCite(
    {
      rules: rules.value,
      providers: loadedProviders.flatMap((loaded) => (loaded.value === undefined ? [] : [loaded.value])),
      files,
      component: consumer.value,
    },
    write,
  );
  const findings = [
    ...rules.findings,
    ...loadedProviders.flatMap((loaded) => loaded.findings),
    ...consumer.findings,
    ...plan.findings,
  ];
  if (write) writeChanges(root, plan.changes);
  return formatCite(findings, plan, write);
}
