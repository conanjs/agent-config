// The `layout` subcommand of build.ts (specs/022 T076, FR-012, DR-412, AC-16.10): checks a repository's root against the rules of
// contracts/repo-layout/v1/rules.yaml. The rules are read through the contract reader and the generated-from line is recognised
// by contracts/lib/render-rules.ts, so no rule is written twice. Pure core (rules and a view of the repository in, findings out)
// and the edge that reads the folder and asks git which files are tracked.
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { readContract } from '#contracts/lib/reader.ts';
import { addGeneratedFromLine } from '#contracts/lib/render-rules.ts';
import { readYaml } from '#contracts/lib/yaml.ts';
import { ExitCode, fail, failure, succeed, type Outcome, type Result, type ToolEnv } from './tool-io.ts';

/** How much of a tracked file is read to see whether it starts with the generated-from line. */
const PREFIX_BYTES = 65_536;

/** One stand-in of a repository: `entry` may be absent when `standIn` exists. */
export interface LayoutException {
  /** The required entry that may be absent. */
  readonly entry: string;
  /** The entry that takes its place. */
  readonly standIn: string;
}

/** A rule about what must not be tracked. */
export type ForbiddenRule =
  | { readonly rule: 'generated-from-line'; readonly message: string }
  | { readonly rule: 'build-output-folder'; readonly message: string; readonly folders: readonly string[] };

/** The rules of `repo-layout/v1`, in the form the check uses. */
export interface LayoutRules {
  /** Entries every repository must have; a trailing `/` means a folder. */
  readonly required: readonly string[];
  /** Entries needed only when the repository holds content documents. */
  readonly requiredIfContent: readonly string[];
  /** The finding for a missing entry, with `{path}` for the entry. */
  readonly missingMessage: string;
  /** What must not be tracked. */
  readonly forbidden: readonly ForbiddenRule[];
  /** Stand-ins, by repository name. */
  readonly exceptions: Readonly<Record<string, readonly LayoutException[]>>;
}

/** What the check looks at in a repository. */
export interface RepoView {
  /** Whether the entry exists: a folder when the path ends with `/`, otherwise a file. */
  readonly has: (entry: string) => boolean;
  /** The files git tracks, as paths with `/`. */
  readonly tracked: readonly string[];
  /** The start of a tracked file's text, `undefined` when it cannot be read as a file. */
  readonly startOf: (file: string) => string | undefined;
  /** Whether the repository holds content documents, so `required-if-content` applies. */
  readonly hasContent: boolean;
}

function mappingOf(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function stringsOf(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function forbiddenOf(item: unknown): ForbiddenRule {
  const rule = mappingOf(item);
  const message = String(rule['message']);
  return rule['rule'] === 'build-output-folder'
    ? { rule: 'build-output-folder', message, folders: stringsOf(rule['folders']) }
    : { rule: 'generated-from-line', message };
}

function exceptionsOf(value: unknown): Record<string, readonly LayoutException[]> {
  return Object.fromEntries(
    Object.entries(mappingOf(value)).map(([repo, list]) => [
      repo,
      (Array.isArray(list) ? list : []).map((item) => {
        const pair = mappingOf(item);
        return { entry: String(pair['entry']), standIn: String(pair['stand-in']) };
      }),
    ]),
  );
}

/**
 * Reads the rules file of `repo-layout/v1`, checking it with the contract reader first.
 *
 * @param text - the whole of `rules.yaml`
 * @returns the rules, or the first problem the reader found, with its field
 */
export function parseRules(text: string): Result<LayoutRules> {
  const checked = readContract('repo-layout/v1', text);
  const first = checked.errors[0];
  if (first !== undefined) return fail(`rules.yaml: ${first.field}: ${first.message}`);
  const read = readYaml(text);
  if (!read.ok) return fail('rules.yaml: cannot be read');
  const doc = mappingOf(read.value);
  return succeed({
    required: stringsOf(doc['required']),
    requiredIfContent: stringsOf(doc['required-if-content']),
    missingMessage: String(doc['missing-message']),
    forbidden: (Array.isArray(doc['forbidden']) ? (doc['forbidden'] as unknown[]) : []).map(forbiddenOf),
    exceptions: exceptionsOf(doc['exceptions']),
  });
}

function message(template: string, entry: string): string {
  return template.replaceAll('{path}', entry);
}

function missing(rules: LayoutRules, repoName: string | undefined, view: RepoView): string[] {
  const stands = repoName === undefined ? [] : (rules.exceptions[repoName] ?? []);
  const wanted = [...rules.required, ...(view.hasContent ? rules.requiredIfContent : [])];
  return wanted
    .filter((entry) => !view.has(entry))
    .filter((entry) => !stands.some((stand) => stand.entry === entry && view.has(stand.standIn)))
    .map((entry) => message(rules.missingMessage, entry));
}

function startsWithGeneratedLine(text: string): boolean {
  // The render rules say what the line is: a text that already holds it at its place is returned unchanged by them.
  return addGeneratedFromLine(text, 'source.md') === text;
}

function forbidden(rule: ForbiddenRule, view: RepoView): string[] {
  const hits =
    rule.rule === 'generated-from-line'
      ? view.tracked.filter((file) => {
          const start = view.startOf(file);
          return start !== undefined && startsWithGeneratedLine(start);
        })
      : view.tracked.filter((file) =>
          rule.folders.some((folder) => file.startsWith(folder) || file.includes(`/${folder}`)),
        );
  return hits.map((file) => message(rule.message, file));
}

/**
 * Lists every way a repository breaks the layout rules, not only the first.
 *
 * @param rules - the rules of `repo-layout/v1`
 * @param repoName - the repository's name for its stand-ins, or `undefined` for none
 * @param view - what the repository holds
 * @returns one message per finding: missing entries first, then each forbidden rule in rule order; empty when the layout is right
 */
export function checkLayout(rules: LayoutRules, repoName: string | undefined, view: RepoView): readonly string[] {
  return [...missing(rules, repoName, view), ...rules.forbidden.flatMap((rule) => forbidden(rule, view))];
}

/**
 * Writes the findings and the summary line the way the scenarios pin them.
 *
 * @param findings - the messages from {@link checkLayout}
 * @param report - report mode, in which findings never fail the run
 * @returns the outcome: a `finding:` line each, then `repo-layout: no findings` or the count; exit 1 on a finding outside report mode
 */
export function formatFindings(findings: readonly string[], report: boolean): Outcome {
  const lines = findings.map((finding) => `finding: ${finding}`);
  if (findings.length === 0) return { code: ExitCode.Ok, out: 'repo-layout: no findings\n', err: '' };
  const summary = `repo-layout: ${findings.length} findings${report ? ' (report mode)' : ''}`;
  return { code: report ? ExitCode.Ok : ExitCode.Failed, out: `${[...lines, summary].join('\n')}\n`, err: '' };
}

// ---- the edge ---------------------------------------------------------------------------------------------------

function kindOf(absolute: string, followLinks = false): fs.Stats | undefined {
  try {
    return followLinks ? fs.statSync(absolute) : fs.lstatSync(absolute);
  } catch {
    return undefined;
  }
}

function startOfFile(absolute: string): string | undefined {
  if (kindOf(absolute)?.isFile() !== true) return undefined;
  const handle = fs.openSync(absolute, 'r');
  try {
    const buffer = Buffer.alloc(PREFIX_BYTES);
    return buffer.subarray(0, fs.readSync(handle, buffer, 0, PREFIX_BYTES, 0)).toString('utf8');
  } finally {
    fs.closeSync(handle);
  }
}

function contentOf(root: string): boolean {
  const text = (() => {
    try {
      return fs.readFileSync(path.join(root, 'component.yaml'), 'utf8');
    } catch {
      return undefined;
    }
  })();
  const read = text === undefined ? undefined : readYaml(text);
  const provides = read?.ok === true ? mappingOf(mappingOf(read.value)['provides']) : {};
  // README of repo-layout/v1: a repository holds content when its component.yaml sets provides.index or provides.exports.
  return provides['index'] !== undefined || stringsOf(provides['exports']).length > 0;
}

function viewOf(root: string, env: ToolEnv): RepoView {
  return {
    has: (entry) => {
      // A link to an existing file or folder counts as present; a broken link does not.
      const kind = kindOf(path.join(root, entry), true);
      return entry.endsWith('/') ? kind?.isDirectory() === true : kind?.isFile() === true;
    },
    tracked: env.gitTracked(root),
    startOf: (file) => startOfFile(path.join(root, file)),
    hasContent: contentOf(root),
  };
}

interface LayoutArgs {
  readonly report: boolean;
  readonly repo: string | undefined;
  readonly root: string;
}

function parseLayoutArgs(argv: readonly string[], env: ToolEnv): Result<LayoutArgs> {
  try {
    const { values } = parseArgs({
      args: [...argv],
      strict: true,
      allowPositionals: false,
      options: { report: { type: 'boolean' }, repo: { type: 'string' }, root: { type: 'string' } },
    });
    return succeed({
      report: values.report === true,
      repo: values.repo,
      root: path.resolve(env.cwd, values.root ?? '.'),
    });
  } catch (cause) {
    return fail(cause instanceof Error ? cause.message : 'the arguments cannot be read');
  }
}

/** Where the contract's own rules file lives, next to the tool that reads it. */
export const RULES_FILE = path.join(import.meta.dirname, '..', 'repo-layout', 'v1', 'rules.yaml');

/**
 * Runs `layout` for the arguments after the subcommand name.
 *
 * @param argv - `[--report] [--repo <name>] [--root <dir>]`
 * @param env - the machine and the moment, so a test can fix them
 * @returns the findings and the exit code: 0 for no findings or in report mode, 1 for a finding otherwise, 2 for a wrong command line
 */
export function runLayout(argv: readonly string[], env: ToolEnv): Outcome {
  const args = parseLayoutArgs(argv, env);
  if (!args.ok) return failure(ExitCode.Usage, `layout: ${args.message}`);
  let rulesText: string;
  try {
    rulesText = fs.readFileSync(RULES_FILE, 'utf8');
  } catch {
    return failure(ExitCode.Failed, `layout: cannot read the rules file ${RULES_FILE}`);
  }
  const rules = parseRules(rulesText);
  if (!rules.ok) return failure(ExitCode.Failed, `layout: ${rules.message}`);
  return formatFindings(checkLayout(rules.value, args.value.repo, viewOf(args.value.root, env)), args.value.report);
}
