// The `budget` subcommand of build.ts, in its dry-run form `budget --baseline` (specs/022 T075, AC-1.7, DR-106, A-28).
// It measures what each agent loads at session start on the text as it would look rendered: every agent-home path swapped
// and the generated-from line added, in memory, with the rules of contracts/lib/render-rules.ts that the phase-5 renderer
// applies too, so the two figures stay comparable. Pure core first (a tree to read and a context in, a report out), then
// the edge that reads the folder and git and, with --out, writes the one file.
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { countCharacters, renderText, type Platform, type SwapContext } from '#contracts/lib/render-rules.ts';
import { readYaml } from '#contracts/lib/yaml.ts';
import { ExitCode, fail, failure, insideRoot, succeed, type Outcome, type Result, type ToolEnv } from './tool-io.ts';

/** The version of this tool, written into every record it makes; the major follows `build/v1`. */
export const TOOL_VERSION = '1';

// How a record says it was measured; the home length is there because the rendered size depends on it.
function methodOf(homeLength: number): string {
  return (
    'dry run, rendered in memory, Unicode code points; tokens_estimate is characters / 4 rounded up; ' +
    `agent home path of ${homeLength} characters; the tree may include uncommitted work, which git rev-parse cannot tell`
  );
}

const PLACEHOLDER = '{{AGENT_HOME}}';
const MAX_IMPORT_DEPTH = 5;
const SKILL_FILE = 'SKILL.md';
const SDLC_PREFIX = 'sdlc-';

// The mapping.yaml targets that tell which files an agent loads at session start (build-v1.md, baseline.feature header).
const CLAUDE_FILE_TARGET = '~/.claude/CLAUDE.md';
const COPILOT_FOLDER_TARGET = '~/.copilot/instructions';
const CODEX_FILE_TARGET = '~/.codex/AGENTS.md';
const CLAUDE_SKILLS_TARGET = '~/.claude/skills';

/** The files of a repository as the measurement reads them; the real one reads a folder, a test passes a map. */
export interface SourceTree {
  /** The text of a file, `undefined` when there is none or it cannot be read; the path is relative with `/`. */
  readonly read: (file: string) => string | undefined;
  /** Every file below a folder, recursively, as sorted relative paths with `/`; empty when the folder is absent. */
  readonly list: (folder: string) => readonly string[];
}

/** One line of mapping.yaml: a source in the repository and where an agent finds it. */
export interface MappingEntry {
  /** Path in the repository. */
  readonly source: string;
  /** Path in the home folder, written with `~`. */
  readonly target: string;
}

/** One file an agent loads: where it is in the repository and its text. */
export interface LoadedFile {
  /** Path in the repository, with `/`. */
  readonly source: string;
  /** The text as written. */
  readonly text: string;
}

/** The record both kinds of agent share. */
export interface AgentRecord {
  /** Rendered characters (Unicode code points) loaded at session start. */
  readonly characters: number;
  /** Estimated tokens; never called `tokens`, because it is a rule of thumb. */
  readonly tokens_estimate: number;
  /** Lines that hold the `{{AGENT_HOME}}` placeholder in the files the agent loads. */
  readonly agent_home_lines: number;
  /** How the figure was measured. */
  readonly method: string;
  /** The version of this tool. */
  readonly tool_version: string;
  /** The Node version it ran on. */
  readonly node_version: string;
  /** The day of the measurement. */
  readonly date: string;
  /** The commit measured. */
  readonly commit: string;
}

/** Claude Code also lists skills at session start, so its record carries the skill list figures. */
export interface ClaudeCodeRecord extends AgentRecord {
  /** Characters of name plus description over every skill. */
  readonly skill_list_characters: number;
  /** The share of that figure that belongs to `sdlc-*` skills. */
  readonly skill_list_sdlc_characters: number;
}

/** The baseline file, `schema: build/v1`. */
export interface BaselineReport {
  /** The contract this document follows. */
  readonly schema: 'build/v1';
  /** One record per agent. */
  readonly agents: {
    readonly 'claude-code': ClaudeCodeRecord;
    readonly 'copilot-cli': AgentRecord;
    readonly codex: AgentRecord;
  };
}

/** What a measurement needs besides the files. */
export interface MeasureInput {
  /** The routing table of the repository. */
  readonly mapping: readonly MappingEntry[];
  /** The repository files. */
  readonly tree: SourceTree;
  /** The home, the system and the allow-list of the swap. */
  readonly context: SwapContext;
  /** The Node version, as `24.12.0`. */
  readonly nodeVersion: string;
  /** The date, as `YYYY-MM-DD`. */
  readonly date: string;
  /** The 40-digit commit id. */
  readonly commit: string;
}

// ---- mapping.yaml ---------------------------------------------------------------------------------------------

function entryOf(item: unknown, position: number): Result<MappingEntry> {
  const entry = typeof item === 'object' && item !== null ? (item as Record<string, unknown>) : {};
  const { source, target } = entry;
  return typeof source === 'string' && typeof target === 'string'
    ? succeed({ source, target })
    : fail(`mapping.yaml: entry ${position + 1} needs a text \`source\` and \`target\``);
}

/**
 * Reads the routing table that says which repository file an agent finds at which place in the home folder.
 *
 * @param text - the whole of mapping.yaml
 * @returns the entries in file order, or why the file is not a list of source and target pairs
 */
export function parseMapping(text: string): Result<readonly MappingEntry[]> {
  const read = readYaml(text);
  if (!read.ok) return fail(`mapping.yaml: ${read.findings[0]?.message ?? 'cannot be read'}`);
  if (!Array.isArray(read.value)) return fail('mapping.yaml: must be a list of entries');
  const entries: MappingEntry[] = [];
  for (const [position, item] of (read.value as unknown[]).entries()) {
    const entry = entryOf(item, position);
    if (!entry.ok) return entry;
    entries.push(entry.value);
  }
  return succeed(entries);
}

function sourceOf(mapping: readonly MappingEntry[], target: string): Result<string> {
  const hit = mapping.find((entry) => entry.target === target);
  return hit === undefined ? fail(`mapping.yaml has no entry with target ${target}`) : succeed(hit.source);
}

// ---- the files each agent loads --------------------------------------------------------------------------------

/**
 * Finds the `@path` imports of a Claude Code memory file, leaving out code blocks and code spans, where Claude Code ignores them.
 *
 * @param text - the text of the file
 * @returns each import as written, without the `@`, in the order found
 */
export function importsOf(text: string): readonly string[] {
  const found: string[] = [];
  let inFence = false;
  for (const line of text.split(/\r?\n/)) {
    if (/^\s*(```|~~~)/.test(line)) inFence = !inFence;
    else if (!inFence) {
      for (const match of line.replace(/`[^`]*`/g, '').matchAll(/(?:^|[\s(])@([^\s)\]>"'`]+)/g)) {
        const spec = (match[1] ?? '').replace(/[.,;:!?]+$/, '');
        if (spec.includes('/') || spec.includes('.')) found.push(spec);
      }
    }
  }
  return found;
}

/**
 * Turns an import written in a memory file into the repository file it loads.
 *
 * @param spec - the import as written: `~/...`, or a path relative to the importing file
 * @param from - the repository path of the importing file
 * @param mapping - the routing table; a `~/` import is found through the longest target that starts it
 * @returns the repository path, or `undefined` for an absolute path, a path that leaves the repository or a home path no entry covers
 */
export function resolveImport(spec: string, from: string, mapping: readonly MappingEntry[]): string | undefined {
  if (spec.startsWith('/')) return undefined;
  if (!spec.startsWith('~/')) {
    const joined = path.posix.normalize(path.posix.join(path.posix.dirname(from), spec));
    return joined.startsWith('..') ? undefined : joined;
  }
  const covering = mapping
    .filter((entry) => spec === entry.target || spec.startsWith(`${entry.target}/`))
    .sort((a, b) => b.target.length - a.target.length)[0];
  return covering === undefined
    ? undefined
    : path.posix.normalize(path.posix.join(covering.source, spec.slice(covering.target.length)));
}

function collect(
  source: string,
  depth: number,
  mapping: readonly MappingEntry[],
  tree: SourceTree,
  loaded: LoadedFile[],
): Result<true> {
  const text = tree.read(source);
  if (text === undefined) return fail(`cannot read ${source}`);
  loaded.push({ source, text });
  if (depth >= MAX_IMPORT_DEPTH) return succeed(true);
  for (const spec of importsOf(text)) {
    const next = resolveImport(spec, source, mapping);
    // An import that names nothing readable is left out, as Claude Code leaves it out.
    if (next !== undefined && !loaded.some((file) => file.source === next) && tree.read(next) !== undefined) {
      const done = collect(next, depth + 1, mapping, tree, loaded);
      if (!done.ok) return done;
    }
  }
  return succeed(true);
}

/** The agents a baseline covers. */
export type AgentId = 'claude-code' | 'copilot-cli' | 'codex';

/**
 * Lists the files an agent loads at session start, as mapping.yaml routes them.
 *
 * Claude Code loads its memory file and the files it imports with `@path` (five levels deep at most); Copilot CLI loads every file
 * below its instructions folder; Codex loads its one AGENTS.md.
 *
 * @param agent - which agent
 * @param mapping - the routing table of the repository
 * @param tree - the repository files
 * @returns the files with their text, in load order, or why a file the agent needs is missing
 */
export function sessionFiles(agent: AgentId, mapping: readonly MappingEntry[], tree: SourceTree): Result<LoadedFile[]> {
  const target = { 'claude-code': CLAUDE_FILE_TARGET, 'copilot-cli': COPILOT_FOLDER_TARGET, codex: CODEX_FILE_TARGET }[
    agent
  ];
  const source = sourceOf(mapping, target);
  if (!source.ok) return source;
  const loaded: LoadedFile[] = [];
  const paths = agent === 'copilot-cli' ? tree.list(source.value) : [source.value];
  for (const first of paths) {
    const done = collect(first, agent === 'claude-code' ? 0 : MAX_IMPORT_DEPTH, mapping, tree, loaded);
    if (!done.ok) return fail(`${agent}: ${done.message}`);
  }
  return paths.length === 0 ? fail(`${agent}: no file below ${source.value}`) : succeed(loaded);
}

// ---- the figures ------------------------------------------------------------------------------------------------

function measureFiles(files: readonly LoadedFile[], context: SwapContext): { characters: number; lines: number } {
  const characters = files.reduce((sum, file) => sum + countCharacters(renderText(file.text, context, file.source)), 0);
  const lines = files.reduce(
    (sum, file) => sum + file.text.split('\n').filter((line) => line.includes(PLACEHOLDER)).length,
    0,
  );
  return { characters, lines };
}

function frontMatterOf(text: string): unknown {
  const match = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/.exec(text);
  const read = match?.[1] === undefined ? undefined : readYaml(match[1]);
  return read?.ok === true ? read.value : undefined;
}

function skillFigure(file: LoadedFile): Result<{ name: string; characters: number }> {
  const front = frontMatterOf(file.text) as { name?: unknown; description?: unknown } | undefined;
  return typeof front?.name === 'string' && typeof front.description === 'string'
    ? succeed({ name: front.name, characters: countCharacters(front.name) + countCharacters(front.description) })
    : fail(`${file.source}: the front matter needs a text name and a text description`);
}

/**
 * Counts what Claude Code lists for skills at session start: the name and the description of each.
 *
 * @param mapping - the routing table, whose `~/.claude/skills` entry names the skills folder
 * @param tree - the repository files
 * @returns the characters of every skill and the share that belongs to skills named `sdlc-*`
 */
export function skillListFigures(
  mapping: readonly MappingEntry[],
  tree: SourceTree,
): Result<{ all: number; sdlc: number }> {
  const source = sourceOf(mapping, CLAUDE_SKILLS_TARGET);
  if (!source.ok) return source;
  const pattern = new RegExp(`^${source.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/[^/]+/${SKILL_FILE}$`);
  let all = 0;
  let sdlc = 0;
  for (const file of tree.list(source.value).filter((candidate) => pattern.test(candidate))) {
    const figure = skillFigure({ source: file, text: tree.read(file) ?? '' });
    if (!figure.ok) return figure;
    all += figure.value.characters;
    if (figure.value.name.startsWith(SDLC_PREFIX)) sdlc += figure.value.characters;
  }
  return succeed({ all, sdlc });
}

function recordOf(input: MeasureInput, files: readonly LoadedFile[]): AgentRecord {
  const { characters, lines } = measureFiles(files, input.context);
  return {
    characters,
    tokens_estimate: Math.ceil(characters / 4),
    agent_home_lines: lines,
    method: methodOf(input.context.home.length),
    tool_version: TOOL_VERSION,
    node_version: input.nodeVersion,
    date: input.date,
    commit: input.commit,
  };
}

/**
 * Measures the always-loaded text of the three agents, rendered in memory.
 *
 * @param input - the repository, the swap context and the facts to record
 * @returns the baseline report, or why a file or a skill could not be read
 */
export function buildBaseline(input: MeasureInput): Result<BaselineReport> {
  const claude = sessionFiles('claude-code', input.mapping, input.tree);
  const copilot = sessionFiles('copilot-cli', input.mapping, input.tree);
  const codex = sessionFiles('codex', input.mapping, input.tree);
  const skills = skillListFigures(input.mapping, input.tree);
  for (const part of [claude, copilot, codex, skills]) if (!part.ok) return part;
  if (!claude.ok || !copilot.ok || !codex.ok || !skills.ok) return fail('unreachable');
  return succeed({
    schema: 'build/v1',
    agents: {
      'claude-code': {
        ...recordOf(input, claude.value),
        skill_list_characters: skills.value.all,
        skill_list_sdlc_characters: skills.value.sdlc,
      },
      'copilot-cli': recordOf(input, copilot.value),
      codex: recordOf(input, codex.value),
    },
  });
}

/**
 * Writes a report the way the baseline file holds it: two-space JSON with a final line break.
 *
 * @param report - the report to write
 * @returns the text of the file
 */
export function formatReport(report: BaselineReport): string {
  return `${JSON.stringify(report, null, 2)}\n`;
}

/**
 * Renders one repository file as an agent would load it, in memory.
 *
 * @param tree - the repository files
 * @param file - the repository path of the file
 * @param context - the home, the system and the allow-list of the swap
 * @returns the rendered text, or why the file cannot be read
 */
export function renderFile(tree: SourceTree, file: string, context: SwapContext): Result<string> {
  const text = tree.read(file);
  return text === undefined ? fail(`cannot read ${file}`) : succeed(renderText(text, context, file));
}

// ---- the edge: the command line, the folder, git ----------------------------------------------------------------

/**
 * Reads a repository folder as a {@link SourceTree}; a path that leaves the folder reads as absent.
 *
 * @param root - the repository folder
 * @returns a tree that reads files below it
 */
export function folderTree(root: string): SourceTree {
  return {
    read(file) {
      const absolute = insideRoot(root, file);
      if (!absolute.ok) return undefined;
      try {
        return fs.readFileSync(absolute.value, 'utf8');
      } catch {
        // Absent and unreadable look the same to the measurement, which names the path it needed.
        return undefined;
      }
    },
    list(folder) {
      const absolute = insideRoot(root, folder);
      if (!absolute.ok) return [];
      try {
        return fs
          .readdirSync(absolute.value, { recursive: true, withFileTypes: true })
          .filter((entry) => entry.isFile())
          .map((entry) => path.relative(root, path.join(entry.parentPath, entry.name)).split(path.sep).join('/'))
          .sort();
      } catch {
        return [];
      }
    },
  };
}

interface BudgetArgs {
  readonly baseline: boolean;
  readonly root: string;
  readonly agentHome: string;
  readonly platform: Platform;
  readonly out: string | undefined;
  readonly render: string | undefined;
  readonly allowList: string | undefined;
}

function platformArg(given: string | undefined, fallback: Platform): Result<Platform> {
  if (given === undefined) return succeed(fallback);
  return given === 'darwin' || given === 'win32' || given === 'linux'
    ? succeed(given)
    : fail('--platform must be darwin, win32 or linux');
}

function parseBudgetArgs(argv: readonly string[], env: ToolEnv): Result<BudgetArgs> {
  try {
    const { values } = parseArgs({
      args: [...argv],
      strict: true,
      allowPositionals: false,
      options: {
        baseline: { type: 'boolean' },
        root: { type: 'string' },
        'agent-home': { type: 'string' },
        platform: { type: 'string' },
        out: { type: 'string' },
        render: { type: 'string' },
        'allow-list': { type: 'string' },
      },
    });
    const platform = platformArg(values.platform, env.platform);
    if (!platform.ok) return platform;
    const agentHome = values['agent-home'] ?? path.join(env.home, '.agent-config');
    if (agentHome.trim() === '') return fail('--agent-home must not be empty');
    if (values.out !== undefined && values.render !== undefined)
      return fail('--out and --render cannot be used together');
    return succeed({
      baseline: values.baseline === true,
      root: path.resolve(env.cwd, values.root ?? '.'),
      agentHome,
      platform: platform.value,
      out: values.out,
      render: values.render,
      allowList: values['allow-list'],
    });
  } catch (cause) {
    // parseArgs reports a wrong option by throwing; the message names the option and never quotes a file.
    return fail(cause instanceof Error ? cause.message : 'the arguments cannot be read');
  }
}

function readIn(tree: SourceTree, root: string, given: string, what: string): Result<string> {
  const inside = insideRoot(root, given);
  if (!inside.ok) return inside;
  const text = tree.read(path.relative(root, inside.value).split(path.sep).join('/'));
  return text === undefined ? fail(`cannot read ${what} ${given}`) : succeed(text);
}

function contextOf(args: BudgetArgs, tree: SourceTree): Result<SwapContext> {
  const allow = args.allowList === undefined ? succeed('') : readIn(tree, args.root, args.allowList, 'the allow-list');
  if (!allow.ok) return allow;
  const allowList = allow.value.split('\n').map((line) => line.replace(/\r$/, ''));
  return succeed({ home: args.agentHome, platform: args.platform, allowList });
}

function toPosix(root: string, absolute: string): string {
  return path.relative(root, absolute).split(path.sep).join('/');
}

function runRender(args: BudgetArgs, tree: SourceTree, context: SwapContext): Outcome {
  const inside = insideRoot(args.root, args.render ?? '');
  if (!inside.ok) return failure(ExitCode.Usage, `budget: ${inside.message}`);
  const rendered = renderFile(tree, toPosix(args.root, inside.value), context);
  return rendered.ok
    ? { code: ExitCode.Ok, out: rendered.value, err: '' }
    : failure(ExitCode.Failed, `budget: ${rendered.message}`);
}

function runBaseline(args: BudgetArgs, tree: SourceTree, context: SwapContext, env: ToolEnv): Outcome {
  const mappingText = tree.read('mapping.yaml');
  if (mappingText === undefined) return failure(ExitCode.Failed, `budget: cannot read mapping.yaml in ${args.root}`);
  const mapping = parseMapping(mappingText);
  if (!mapping.ok) return failure(ExitCode.Failed, `budget: ${mapping.message}`);
  const commit = env.gitHead(args.root);
  if (!commit.ok) return failure(ExitCode.Failed, `budget: ${commit.message}`);
  const report = buildBaseline({
    mapping: mapping.value,
    tree,
    context,
    nodeVersion: env.nodeVersion,
    date: env.today,
    commit: commit.value,
  });
  if (!report.ok) return failure(ExitCode.Failed, `budget: ${report.message}`);
  return args.out === undefined
    ? { code: ExitCode.Ok, out: formatReport(report.value), err: '' }
    : writeReport(args, report.value);
}

function writeReport(args: BudgetArgs, report: BaselineReport): Outcome {
  const inside = insideRoot(args.root, args.out ?? '');
  if (!inside.ok) return failure(ExitCode.Usage, `budget: --out ${inside.message}`);
  try {
    fs.mkdirSync(path.dirname(inside.value), { recursive: true });
    fs.writeFileSync(inside.value, formatReport(report));
  } catch (cause) {
    const code = cause instanceof Error && 'code' in cause ? String(cause.code) : 'error';
    return failure(ExitCode.Failed, `budget: cannot write ${args.out ?? ''} (${code})`);
  }
  return { code: ExitCode.Ok, out: `wrote ${toPosix(args.root, inside.value)}\n`, err: '' };
}

/**
 * Runs `budget` for the arguments after the subcommand name.
 *
 * Only the dry run is built: `--baseline` prints the report as JSON and writes nothing, `--out <file>` writes it to a file below
 * `--root`, `--render <file>` prints one file as rendered. Anything else is a usage error.
 *
 * @param argv - the arguments, for example `['--baseline', '--agent-home', '/Users/v/.agent-config']`
 * @param env - the machine and the moment, so a test can fix them
 * @returns the exit code and the text for each stream
 */
export function runBudget(argv: readonly string[], env: ToolEnv): Outcome {
  const args = parseBudgetArgs(argv, env);
  if (!args.ok) return failure(ExitCode.Usage, `budget: ${args.message}`);
  if (!args.value.baseline) {
    return failure(ExitCode.Usage, 'budget: this version builds only `budget --baseline`; see `build.ts --help`');
  }
  const tree = folderTree(args.value.root);
  const context = contextOf(args.value, tree);
  if (!context.ok) return failure(ExitCode.Failed, `budget: ${context.message}`);
  return args.value.render === undefined
    ? runBaseline(args.value, tree, context.value, env)
    : runRender(args.value, tree, context.value);
}
