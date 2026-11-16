// The check of the local files (specs/022 T150; requirements: tests/installer-sources/sources.feature, AC-3.8, FR-019;
// message MG-40 of specs/022-repo-split/contracts/installer-cli.md).
// components.local.yaml and variables.local.yaml hold a person's own choices, so they must never be tracked by git or staged for
// a commit. Scope: the repository root only, because that is where the installer reads them (the agent home root, which a
// checkout can be; plan.md "H/components.local.yaml, H/variables.local.yaml", contracts/components-list/v1/README.md CL-2).
// A file of the same name deeper down is not a local file: the contract example examples/valid/components.local.yaml and the
// test fixtures are tracked on purpose and the installer never reads them as a local list.
//
// Usage: node scripts/check-local-files.ts <repo folder>
// Prints `error: <path> is tracked by git` or `error: <path> is staged for commit` per file (sorted by path), or
// `ok: no local file is tracked or staged`. A file that is both tracked and staged is reported once, as tracked.
// Exit codes: 0 pass, 1 a local file is tracked or staged (or git cannot be read), 2 a usage error.
import { execFileSync } from 'node:child_process';
import path from 'node:path';

/** The base names of the local files. */
export const LOCAL_FILE_NAMES: readonly string[] = ['components.local.yaml', 'variables.local.yaml'];

const EXIT_PASS = 0;
const EXIT_FINDING = 1;
const EXIT_USAGE = 2;

/** What a run reports: output lines and the exit code. */
export interface Outcome {
  /** The exit code. */
  readonly code: number;
  /** The output lines. */
  readonly lines: readonly string[];
}

/**
 * Tells whether a repository path is one of the local files, which sit at the repository root.
 *
 * @param file - a path relative to the repository, with `/` separators
 * @returns true when the path is exactly a local file name, with no folder in front
 */
export function isLocalFile(file: string): boolean {
  return LOCAL_FILE_NAMES.includes(file);
}

/**
 * Builds the output from the tracked and the staged paths.
 *
 * @param tracked - the paths in the index that were committed before
 * @param staged - the paths that are new in the index (added, copied or renamed)
 * @returns the lines to print and the exit code
 */
export function check(tracked: readonly string[], staged: readonly string[]): Outcome {
  const trackedLocal = new Set(tracked.filter(isLocalFile));
  const stagedLocal = new Set(staged.filter((file) => isLocalFile(file) && !trackedLocal.has(file)));
  const findings = [
    ...[...trackedLocal].map((file) => ({ file, line: `error: ${file} is tracked by git` })),
    ...[...stagedLocal].map((file) => ({ file, line: `error: ${file} is staged for commit` })),
  ].sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : 0));
  return findings.length === 0
    ? { code: EXIT_PASS, lines: ['ok: no local file is tracked or staged'] }
    : { code: EXIT_FINDING, lines: findings.map((f) => f.line) };
}

/**
 * Runs git in a folder with no shell and the outer GIT_* variables removed.
 *
 * @param folder - the repository folder
 * @param args - the git arguments, ending in `--`
 * @returns the paths git printed, split at NUL
 */
function gitPaths(folder: string, args: readonly string[]): readonly string[] {
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')));
  const out = execFileSync('git', [...args], { cwd: folder, env, encoding: 'utf8', maxBuffer: 1 << 28, stdio: 'pipe' });
  return out.split('\0').filter((p) => p !== '');
}

/**
 * Runs the check on a repository folder.
 *
 * @param folder - the repository folder
 * @returns the lines to print and the exit code
 */
export function run(folder: string): Outcome {
  try {
    // `git ls-files` lists the index, so a file added by `git add` is in it too: what is new in the index (added, copied or
    // renamed) is staged; the rest of the index was committed before and is tracked (also when it is staged as modified).
    const added = gitPaths(folder, ['diff', '--cached', '--name-only', '--diff-filter=ACR', '-z', '--']);
    const tracked = gitPaths(folder, ['ls-files', '-z', '--']).filter((file) => !added.includes(file));
    const staged = added;
    return check(tracked, staged);
  } catch (error) {
    const detail = error instanceof Error ? error.message.split('\n')[0] : String(error);
    return { code: EXIT_FINDING, lines: [`error: cannot read the git state of ${folder}: ${detail}`] };
  }
}

if (import.meta.main) {
  const [folder, ...rest] = process.argv.slice(2);
  if (folder === undefined || rest.length > 0) {
    process.stderr.write('Usage: node scripts/check-local-files.ts <repo folder>\n');
    process.exitCode = EXIT_USAGE;
  } else {
    const outcome = run(path.resolve(folder));
    process.stdout.write(`${outcome.lines.join('\n')}\n`);
    process.exitCode = outcome.code;
  }
}
