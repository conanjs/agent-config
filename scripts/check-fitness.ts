// The architecture fitness check (specs/022 T081; requirements: tests/fitness/fitness.feature, AC-1.6, FR-008).
// It reads the architecture map from copilot/atlas/atlas.yaml and the recorded counts from docs/baselines/fitness.json and
// fails in four cases: a declared edge the map forbids (FIT-1), a count of mentions that cross a component boundary
// above its recorded baseline (FIT-2), and an atlas edge that docs/architecture.md (its `layers` block, `may-depend-on`) does not
// draw (FIT-4), or the reverse (FIT-5). A count below its baseline passes; lowering the baseline is a human edit.
//
// Usage: node scripts/check-fitness.ts [--root <dir>] [--measure]
//   --root     the tree to check (default: the current folder)
//   --measure  print the measured counts for the keys of the baseline file as JSON, so a baseline can be recorded (T082)
// Exit codes: 0 pass, 1 a finding, 2 a usage error.
//
// Keys of the atlas this check reads (they sit beside the kind-level `edges:` that atlas.mjs reads, and do not replace it):
//   components:       - { id, paths: [folders], mention: "<text>", mention-in: { <component id>: "<regular expression>" } }
//   component-edges:  - { from, to }                  the allowed edges, one line each
//   forbidden-edges:  - { from, to }                  `*` on either side means every other component
//   (a component may also carry `layer: <name>` when docs/architecture.md calls it by another name)
//   check-files:      ["check-*.mjs", ...]            base-name patterns of the "checks" (default: check-*.mjs)
// A mention is a line of a `.md` file under one component's paths that contains another component's `mention` text, or
// matches that component's `mention-in` expression for this owner (used where the plain text over-counts, for example
// the placeholder path `companies/<co>/` is not a citation). A check is a file named by `check-files` under a component's
// paths that mentions another component, counted once per file; the two kinds of count never share a file.
// Counts: `<from>-to-<to>-lines`, `<from>-to-<to>-files` and `checks-reading-other-areas`.
import fs from 'node:fs';
import path from 'node:path';
import { readYaml } from '#contracts/lib/yaml.ts';

/** Version of this tool, written into the baseline file with the method (T082). */
export const TOOL_VERSION = '1';

const ATLAS_FILE = 'copilot/atlas/atlas.yaml';
const BASELINE_FILE = 'docs/baselines/fitness.json';
const ARCHITECTURE_FILE = 'docs/architecture.md';
const CHECKS_COUNT = 'checks-reading-other-areas';
const DEFAULT_CHECK_FILES: readonly string[] = ['check-*.mjs'];
const SKIPPED_FOLDERS: ReadonlySet<string> = new Set(['node_modules', '.git']);
const EXIT_PASS = 0;
const EXIT_FINDING = 1;
const EXIT_USAGE = 2;

/** One part of the architecture map: the folders it owns and how a mention of it reads in another part's files. */
export interface Component {
  /** The id the atlas and the baseline use. */
  readonly id: string;
  /** The folders it owns, relative to the root. */
  readonly paths: readonly string[];
  /** The text that counts as a mention of it. */
  readonly mention: string;
  /** Per owner component, an expression that replaces the plain `mention` text when that owner's files are scanned. */
  readonly mentionIn: Readonly<Record<string, RegExp>>;
  /** The name of this component in the `layers` block of docs/architecture.md (default: the id). */
  readonly layer: string;
}

/** A dependency between two components, `*` meaning every component. */
export interface Edge {
  /** The component that cites. */
  readonly from: string;
  /** The component that is cited. */
  readonly to: string;
}

/** The architecture map as read from the atlas. */
export interface Registry {
  /** Every component. */
  readonly components: readonly Component[];
  /** The allowed edges. */
  readonly edges: readonly Edge[];
  /** The forbidden edges. */
  readonly forbidden: readonly Edge[];
  /** Base-name patterns of the check files. */
  readonly checkFiles: readonly string[];
}

/** A file read from the tree, with its path relative to the root. */
export interface SourceFile {
  /** The path relative to the root. */
  readonly path: string;
  /** The file contents. */
  readonly text: string;
}

/** Counts by name, for example `core-to-companies-lines`. */
export type Counts = Readonly<Record<string, number>>;

/** A value or the reasons it could not be made (an expected failure is a value). */
export type Parsed<T> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly problems: readonly string[] };

/** What a run reports: output lines and the exit code. */
export interface Outcome {
  /** The exit code. */
  readonly code: number;
  /** The output lines. */
  readonly lines: readonly string[];
}

const fail = (...problems: string[]): { ok: false; problems: string[] } => ({ ok: false, problems });
const succeed = <T>(value: T): { ok: true; value: T } => ({ ok: true, value });

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringList(value: unknown): readonly string[] | null {
  return Array.isArray(value) && value.every((item) => typeof item === 'string' && item !== '')
    ? (value as string[])
    : null;
}

/**
 * Reads the `mention-in` map of a component: owner id to a regular expression.
 *
 * @param id - the component being read, used in messages
 * @param raw - the value of its `mention-in` key, or undefined
 * @returns the compiled expressions, or the problems found
 */
function readMentionIn(id: string, raw: unknown): Parsed<Record<string, RegExp>> {
  if (raw === undefined) return succeed({});
  if (!isRecord(raw)) return fail(`${ATLAS_FILE}: component ${id}: mention-in must be a map of owner id to expression`);
  const compiled: Record<string, RegExp> = {};
  for (const [owner, source] of Object.entries(raw)) {
    try {
      if (typeof source !== 'string' || source === '') throw new Error('empty');
      compiled[owner] = new RegExp(source);
    } catch {
      return fail(`${ATLAS_FILE}: component ${id}: mention-in ${owner} is not a regular expression`);
    }
  }
  return succeed(compiled);
}

function readComponent(raw: unknown): Parsed<Component> {
  if (!isRecord(raw) || typeof raw['id'] !== 'string' || raw['id'] === '') {
    return fail(`${ATLAS_FILE}: a component needs an id`);
  }
  const id = raw['id'];
  const paths = stringList(raw['paths']);
  if (paths === null) return fail(`${ATLAS_FILE}: component ${id}: paths must be a list of folders`);
  const mention = raw['mention'];
  if (typeof mention !== 'string' || mention === '') return fail(`${ATLAS_FILE}: component ${id}: mention is missing`);
  const mentionIn = readMentionIn(id, raw['mention-in']);
  if (!mentionIn.ok) return mentionIn;
  const layer = typeof raw['layer'] === 'string' && raw['layer'] !== '' ? raw['layer'] : id;
  return succeed({ id, paths, mention, mentionIn: mentionIn.value, layer });
}

function readEdge(key: string, item: unknown, known: ReadonlySet<string>, wildcard: boolean): Parsed<Edge> {
  const from = isRecord(item) ? item['from'] : undefined;
  const to = isRecord(item) ? item['to'] : undefined;
  if (typeof from !== 'string' || typeof to !== 'string')
    return fail(`${ATLAS_FILE}: ${key}: an edge needs from and to`);
  const unknown = [from, to].find((end) => !known.has(end) && !(wildcard && end === '*'));
  return unknown === undefined ? succeed({ from, to }) : fail(`${ATLAS_FILE}: ${key}: "${unknown}" is not a component`);
}

function readEdges(key: string, raw: unknown, known: ReadonlySet<string>, wildcard: boolean): Parsed<readonly Edge[]> {
  if (raw === undefined) return succeed([]);
  if (!Array.isArray(raw)) return fail(`${ATLAS_FILE}: ${key} must be a list`);
  const edges: Edge[] = [];
  for (const item of raw) {
    const edge = readEdge(key, item, known, wildcard);
    if (!edge.ok) return edge;
    edges.push(edge.value);
  }
  return succeed(edges);
}

/**
 * Reads the architecture map out of the atlas text.
 *
 * @param text - the contents of copilot/atlas/atlas.yaml
 * @returns the registry, or the problems that make the map unusable
 */
export function readRegistry(text: string): Parsed<Registry> {
  const document = readYaml(text);
  if (!document.ok) return fail(...document.findings.map((f) => `${ATLAS_FILE}: ${f.message}`));
  const root = document.value;
  if (!isRecord(root) || !Array.isArray(root['components'])) return fail(`${ATLAS_FILE}: no components list`);
  const components: Component[] = [];
  for (const raw of root['components']) {
    const component = readComponent(raw);
    if (!component.ok) return component;
    components.push(component.value);
  }
  const known = new Set(components.map((c) => c.id));
  const edges = readEdges('component-edges', root['component-edges'], known, false);
  if (!edges.ok) return edges;
  const forbidden = readEdges('forbidden-edges', root['forbidden-edges'], known, true);
  if (!forbidden.ok) return forbidden;
  const checkFiles = root['check-files'] === undefined ? DEFAULT_CHECK_FILES : stringList(root['check-files']);
  if (checkFiles === null) return fail(`${ATLAS_FILE}: check-files must be a list of file name patterns`);
  return succeed({ components, edges: edges.value, forbidden: forbidden.value, checkFiles });
}

/**
 * The FIT-1 findings: every declared edge that a forbidden edge covers.
 *
 * @param registry - the architecture map
 * @returns one `FIT-1 forbidden edge <from> -> <to>` line per declared edge that is forbidden, in declaration order
 */
export function forbiddenEdgeFindings(registry: Registry): readonly string[] {
  const covers = (rule: Edge, edge: Edge): boolean =>
    (rule.from === '*' || rule.from === edge.from) && (rule.to === '*' || rule.to === edge.to);
  const hits = registry.edges.filter(
    (edge) => edge.from !== edge.to && registry.forbidden.some((rule) => covers(rule, edge)),
  );
  return [...new Set(hits.map((edge) => `FIT-1 forbidden edge ${edge.from} -> ${edge.to}`))];
}

function readLayer(item: unknown): { readonly name: string; readonly dependsOn: readonly string[] } | null {
  const dependsOn = isRecord(item) ? stringList(item['may-depend-on']) : null;
  return isRecord(item) && typeof item['name'] === 'string' && dependsOn !== null
    ? { name: item['name'], dependsOn }
    : null;
}

/**
 * Reads the dependencies each layer declares in the `layers` blocks of docs/architecture.md.
 *
 * @param text - the contents of docs/architecture.md
 * @returns the layer names with the layers they may depend on, or the problems that make a block unreadable
 */
export function readArchitectureLayers(text: string): Parsed<ReadonlyMap<string, readonly string[]>> {
  const layers = new Map<string, readonly string[]>();
  for (const block of text.matchAll(/```yaml\n([\s\S]*?)```/g)) {
    const document = readYaml(block[1] ?? '');
    if (!document.ok) return fail(...document.findings.map((f) => `${ARCHITECTURE_FILE}: ${f.message}`));
    const list = isRecord(document.value) ? document.value['layers'] : undefined;
    for (const item of Array.isArray(list) ? list : []) {
      const layer = readLayer(item);
      if (layer !== null) layers.set(layer.name, layer.dependsOn);
    }
  }
  return succeed(layers);
}

/**
 * The FIT-4 and FIT-5 findings: where the atlas edges and the architecture's layer dependencies disagree.
 * Only components that docs/architecture.md names as layers are compared; an edge to contracts is not a layer edge.
 *
 * @param registry - the architecture map of the atlas
 * @param layers - the layers of docs/architecture.md with the layers each may depend on
 * @returns one line per edge present on one side only, atlas-only edges first
 */
export function architectureFindings(
  registry: Registry,
  layers: ReadonlyMap<string, readonly string[]>,
): readonly string[] {
  const named = registry.components.filter((c) => layers.has(c.layer));
  const idOf = (layer: string): string | undefined => named.find((c) => c.layer === layer)?.id;
  const key = (from: string, to: string): string => `${from} -> ${to}`;
  const drawn = new Set(
    named.flatMap((c) => (layers.get(c.layer) ?? []).flatMap((dep) => idOf(dep) ?? []).map((to) => key(c.id, to))),
  );
  const declared = new Set(
    registry.edges
      .filter((e) => named.some((c) => c.id === e.from) && named.some((c) => c.id === e.to))
      .map((e) => key(e.from, e.to)),
  );
  return [
    ...[...declared].filter((e) => !drawn.has(e)).map((e) => `FIT-4 atlas edge ${e} is not in ${ARCHITECTURE_FILE}`),
    ...[...drawn]
      .filter((e) => !declared.has(e))
      .map((e) => `FIT-5 ${ARCHITECTURE_FILE} edge ${e} is not in the atlas`),
  ];
}

/**
 * Whether one line of an owner's file mentions the target component.
 *
 * @param owner - the component whose file is read
 * @param target - the component that may be mentioned
 * @param text - a line (or a whole file) of the owner's
 * @returns true when the text contains the target's mention for this owner
 */
export function mentions(owner: Component, target: Component, text: string): boolean {
  const expression = target.mentionIn[owner.id];
  return expression === undefined ? text.includes(target.mention) : expression.test(text);
}

/**
 * Counts the lines and the files of an owner's documents that mention a target.
 *
 * @param owner - the component whose documents are read
 * @param target - the component that may be mentioned
 * @param documents - the owner's `.md` files
 * @returns the number of mention lines and of files holding at least one
 */
export function countMentions(
  owner: Component,
  target: Component,
  documents: readonly SourceFile[],
): { readonly lines: number; readonly files: number } {
  const perFile = documents.map((doc) => doc.text.split('\n').filter((line) => mentions(owner, target, line)).length);
  return { lines: perFile.reduce((sum, n) => sum + n, 0), files: perFile.filter((n) => n > 0).length };
}

/**
 * Counts the checks that read another component's files, once per file.
 *
 * @param components - every component of the map
 * @param checksByOwner - the check files found under each component, by component id
 * @returns the number of check files whose text mentions a component other than their owner
 */
export function countChecks(
  components: readonly Component[],
  checksByOwner: ReadonlyMap<string, readonly SourceFile[]>,
): number {
  let total = 0;
  for (const owner of components) {
    for (const file of checksByOwner.get(owner.id) ?? []) {
      if (components.some((target) => target.id !== owner.id && mentions(owner, target, file.text))) total += 1;
    }
  }
  return total;
}

/**
 * Turns a base-name pattern with `*` as its only wildcard into a test on a file name.
 *
 * @param pattern - for example `check-*.mjs`
 * @returns a function that is true for a name the pattern matches
 */
function nameMatcher(pattern: string): (name: string) => boolean {
  const body = pattern.split('*').map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'));
  const expression = new RegExp(`^${body.join('.*')}$`);
  return (name) => expression.test(name);
}

function walk(root: string, folder: string, accept: (name: string) => boolean): SourceFile[] {
  const absolute = path.join(root, folder);
  if (!fs.existsSync(absolute)) return [];
  const found: SourceFile[] = [];
  for (const entry of fs.readdirSync(absolute, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const relative = `${folder}/${entry.name}`;
    if (entry.isDirectory() && !SKIPPED_FOLDERS.has(entry.name)) found.push(...walk(root, relative, accept));
    else if (entry.isFile() && accept(entry.name)) {
      found.push({ path: relative, text: fs.readFileSync(path.join(root, relative), 'utf8') });
    }
  }
  return found;
}

/**
 * Reads the files under a component's paths whose base name passes `accept`, each file once.
 *
 * @param root - the tree to read
 * @param component - the component whose paths are walked
 * @param accept - a test on the base name
 * @returns the files read; a path that does not exist gives none
 */
function filesOf(root: string, component: Component, accept: (name: string) => boolean): SourceFile[] {
  const byPath = new Map<string, SourceFile>();
  for (const folder of component.paths) for (const file of walk(root, folder, accept)) byPath.set(file.path, file);
  return [...byPath.values()];
}

/**
 * Splits a count name into its pair of components and its unit.
 *
 * @param name - for example `core-to-companies-lines`
 * @param components - every component of the map
 * @returns the pair and the unit, or null for a name that is not `<from>-to-<to>-lines|files`
 */
function splitName(
  name: string,
  components: readonly Component[],
): { from: Component; to: Component; unit: 'lines' | 'files' } | null {
  const unit = name.endsWith('-lines') ? 'lines' : name.endsWith('-files') ? 'files' : null;
  if (unit === null) return null;
  const pair = name.slice(0, name.length - unit.length - 1);
  for (const from of components) {
    const to = components.find((c) => pair === `${from.id}-to-${c.id}`);
    if (to !== undefined) return { from, to, unit };
  }
  return null;
}

/**
 * Measures the named counts on a tree.
 *
 * @param root - the tree to read
 * @param registry - the architecture map
 * @param names - the count names to measure
 * @returns the counts, or the problem with a name this check does not know
 */
export function measure(root: string, registry: Registry, names: readonly string[]): Parsed<Counts> {
  const counts: Record<string, number> = {};
  const documents = new Map<string, readonly SourceFile[]>();
  const docsOf = (c: Component): readonly SourceFile[] => {
    const known = documents.get(c.id);
    if (known !== undefined) return known;
    const read = filesOf(root, c, (name) => name.endsWith('.md'));
    documents.set(c.id, read);
    return read;
  };
  for (const name of names) {
    if (name === CHECKS_COUNT) {
      const accepts = registry.checkFiles.map(nameMatcher);
      const checks = new Map(
        registry.components.map((c) => [c.id, filesOf(root, c, (n) => accepts.some((accept) => accept(n)))] as const),
      );
      counts[name] = countChecks(registry.components, checks);
      continue;
    }
    const parts = splitName(name, registry.components);
    if (parts === null) return fail(`${BASELINE_FILE}: "${name}" is not a count this check knows`);
    counts[name] = countMentions(parts.from, parts.to, docsOf(parts.from))[parts.unit];
  }
  return succeed(counts);
}

/**
 * Reads the recorded counts out of the baseline text.
 *
 * @param text - the contents of docs/baselines/fitness.json
 * @returns the counts, or the problems that make the file unusable
 */
export function readBaseline(text: string): Parsed<Counts> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return fail(`${BASELINE_FILE}: not valid JSON`);
  }
  const counts = isRecord(parsed) ? parsed['counts'] : undefined;
  if (!isRecord(counts)) return fail(`${BASELINE_FILE}: no counts object`);
  const entries = Object.entries(counts);
  const bad = entries.find(([, value]) => !Number.isInteger(value) || (value as number) < 0);
  if (bad !== undefined) return fail(`${BASELINE_FILE}: ${bad[0]} must be a whole number of zero or more`);
  return succeed(Object.fromEntries(entries) as Counts);
}

/**
 * Names the fitness function a finding implements (system-architecture section 7).
 *
 * @param name - a count name or `edge`
 * @returns FF-1 for a count of core (a required component must not cite an optional one), FF-2 for every other boundary
 */
function fitnessFunctionLine(name: string): string {
  return name.startsWith('core-to-')
    ? '  FF-1: a required component must not cite an optional one'
    : '  FF-2: the components stay acyclic and the counts do not rise';
}

/**
 * Lists the counts that rose above the baseline and those that fell below it.
 *
 * @param baseline - the recorded counts
 * @param now - the measured counts, one per baseline key
 * @returns the FIT-2 lines for counts that rose, and a note for each count that fell
 */
export function compareCounts(
  baseline: Counts,
  now: Counts,
): { readonly rises: readonly string[]; readonly falls: readonly string[] } {
  const rises: string[] = [];
  const falls: string[] = [];
  for (const [name, recorded] of Object.entries(baseline)) {
    const current = now[name] ?? 0;
    if (current > recorded) rises.push(`FIT-2 ${name} rose from ${recorded} to ${current}`, fitnessFunctionLine(name));
    else if (current < recorded) falls.push(`note: ${name} fell from ${recorded} to ${current}; lower the baseline`);
  }
  return { rises, falls };
}

function readText(root: string, relative: string): string | null {
  const file = path.join(root, relative);
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
}

/**
 * Collects the FIT-1, FIT-4 and FIT-5 lines for a tree.
 *
 * @param root - the tree to check
 * @param registry - the architecture map of the atlas
 * @returns the lines, or the problem that stops the comparison with docs/architecture.md
 */
function edgeFindings(root: string, registry: Registry): Parsed<readonly string[]> {
  const architecture = readText(root, ARCHITECTURE_FILE);
  if (architecture === null) return fail(`check-fitness: architecture file missing: ${ARCHITECTURE_FILE}`);
  const layers = readArchitectureLayers(architecture);
  if (!layers.ok) return layers;
  return succeed([
    ...forbiddenEdgeFindings(registry).flatMap((line) => [line, fitnessFunctionLine('edge')]),
    ...architectureFindings(registry, layers.value),
  ]);
}

/**
 * Runs the check on a tree.
 *
 * @param root - the tree to check
 * @param printCounts - when true, print the measured counts instead of comparing them
 * @returns the lines to print and the exit code
 */
export function run(root: string, printCounts: boolean): Outcome {
  const baselineText = readText(root, BASELINE_FILE);
  if (baselineText === null) return { code: EXIT_FINDING, lines: [`FIT-3 baseline file missing: ${BASELINE_FILE}`] };
  const atlasText = readText(root, ATLAS_FILE);
  if (atlasText === null) return { code: EXIT_FINDING, lines: [`check-fitness: atlas file missing: ${ATLAS_FILE}`] };
  const registry = readRegistry(atlasText);
  if (!registry.ok) return { code: EXIT_FINDING, lines: registry.problems };
  const baseline = readBaseline(baselineText);
  if (!baseline.ok) return { code: EXIT_FINDING, lines: baseline.problems };
  const now = measure(root, registry.value, Object.keys(baseline.value));
  if (!now.ok) return { code: EXIT_FINDING, lines: now.problems };
  if (printCounts) return { code: EXIT_PASS, lines: [JSON.stringify({ counts: now.value }, null, 2)] };
  const edges = edgeFindings(root, registry.value);
  if (!edges.ok) return { code: EXIT_FINDING, lines: edges.problems };
  const { rises, falls } = compareCounts(baseline.value, now.value);
  if (edges.value.length + rises.length > 0) {
    return { code: EXIT_FINDING, lines: [...edges.value, ...rises, ...falls] };
  }
  const verdict = falls.length === 0 ? 'check-fitness: counts equal the baseline' : 'check-fitness: no count rose';
  return { code: EXIT_PASS, lines: [verdict, ...falls] };
}

/**
 * Reads the command line.
 *
 * @param argv - the arguments after the script name
 * @returns the root and the `--measure` choice, or null for a usage error
 */
function parseArguments(argv: readonly string[]): { readonly root: string; readonly measure: boolean } | null {
  let root = process.cwd();
  let measureOnly = false;
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (flag === '--measure') measureOnly = true;
    else if (flag === '--root' && value !== undefined && !value.startsWith('--')) {
      root = path.resolve(value);
      i += 1;
    } else return null;
  }
  return { root, measure: measureOnly };
}

if (import.meta.main) {
  const options = parseArguments(process.argv.slice(2));
  if (options === null) {
    process.stderr.write('Usage: node scripts/check-fitness.ts [--root <dir>] [--measure]\n');
    process.exitCode = EXIT_USAGE;
  } else {
    const outcome = run(options.root, options.measure);
    process.stdout.write(`${outcome.lines.join('\n')}\n`);
    process.exitCode = outcome.code;
  }
}
