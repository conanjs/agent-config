// What the build tools share (specs/022 T075 to T078): the outcome of one run, the environment a run is given, and the
// few effects every subcommand needs. A subcommand is a function from its arguments and an environment to an outcome; only
// the entry point (build.ts or check-schemas.ts run as a script) turns an outcome into output and an exit code, so the
// subcommands are testable with an environment made of plain values.
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import type { Platform } from '#contracts/lib/render-rules.ts';

/** Exit codes of every subcommand (A-8): ok, a check failed, the command line was wrong. */
export const ExitCode = { Ok: 0, Failed: 1, Usage: 2 } as const;

/** What one run produced: the exit code and the text for each stream, each empty or ending with a line break. */
export interface Outcome {
  /** One of {@link ExitCode}. */
  readonly code: number;
  /** Text for standard output. */
  readonly out: string;
  /** Text for standard error. */
  readonly err: string;
}

/** A value, or the reason there is none; an expected failure is a value, not an exception (ERR-1). */
export type Result<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly message: string };

/**
 * Wraps a value as a successful result.
 *
 * @param value - the value to carry
 * @returns the successful result
 */
export function succeed<T>(value: T): Result<T> {
  return { ok: true, value };
}

/**
 * Wraps a reason as a failed result.
 *
 * @param message - one sentence that says what went wrong and where
 * @returns the failed result
 */
export function fail<T = never>(message: string): Result<T> {
  return { ok: false, message };
}

/** The facts about the machine and the moment that a run may not read for itself, so a test can fix them. */
export interface ToolEnv {
  /** The folder relative file arguments resolve against. */
  readonly cwd: string;
  /** The user's home folder; the default agent home is `.agent-config` inside it. */
  readonly home: string;
  /** The system the paths are written for. */
  readonly platform: Platform;
  /** Today's date as `YYYY-MM-DD`. */
  readonly today: string;
  /** The Node version as `24.12.0`. */
  readonly nodeVersion: string;
  /** The 40-digit commit id of HEAD in a folder, read with `git rev-parse` only. */
  readonly gitHead: (root: string) => Result<string>;
  /** The files git tracks in a folder, as paths with `/` separators; empty when the folder is not a repository. */
  readonly gitTracked: (root: string) => readonly string[];
}

/**
 * Turns a failed run into the outcome that reports it to the person on the command line.
 *
 * @param code - {@link ExitCode.Failed} or {@link ExitCode.Usage}
 * @param message - what went wrong, without a line break
 * @returns an outcome with the message on standard error
 */
export function failure(code: number, message: string): Outcome {
  return { code, out: '', err: `${message}\n` };
}

function platformOf(name: string): Platform {
  return name === 'darwin' || name === 'win32' ? name : 'linux';
}

function head(root: string): Result<string> {
  try {
    // Only `rev-parse` is run, so measuring never changes the repository (AC-1.7).
    const id = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return /^[0-9a-f]{40}$/.test(id.trim()) ? succeed(id.trim()) : fail('git rev-parse HEAD gave no commit id');
  } catch {
    return fail(
      `cannot read the commit of ${root}: it is not a git repository with a commit (git rev-parse HEAD failed)`,
    );
  }
}

function tracked(root: string): readonly string[] {
  try {
    const listing = execFileSync('git', ['ls-files', '-z'], {
      cwd: root,
      encoding: 'utf8',
      maxBuffer: 256 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return listing.split('\0').filter((name) => name !== '');
  } catch {
    // Not a repository: nothing is tracked, so the rules about tracked files have nothing to find.
    return [];
  }
}

/**
 * Reads the environment of the process that runs the tool.
 *
 * @returns the working folder, home folder, system, date, Node version and the two git readers
 */
export function realEnv(): ToolEnv {
  return {
    cwd: process.cwd(),
    home: os.homedir(),
    platform: platformOf(process.platform),
    today: new Date().toISOString().slice(0, 10),
    nodeVersion: process.versions.node,
    gitHead: head,
    gitTracked: tracked,
  };
}

/**
 * Resolves a path given on the command line against a root and refuses one that leaves it.
 *
 * @param root - the folder the path must stay inside
 * @param given - the path as written, relative to `root` or absolute
 * @returns the absolute path, or why it was refused
 */
export function insideRoot(root: string, given: string): Result<string> {
  const absolute = path.resolve(root, given);
  const relative = path.relative(root, absolute);
  return relative.startsWith('..') || path.isAbsolute(relative)
    ? fail(`${given} is outside the root ${root}`)
    : succeed(absolute);
}

/**
 * Makes a message safe to print on one line: control characters, including line breaks and escape codes, become `?`.
 *
 * @param text - text that may hold characters from a file under check
 * @returns the text with every control character replaced
 */
export function oneLine(text: string): string {
  // eslint-disable-next-line no-control-regex -- the control characters are the point of this function
  return text.replace(/[\u0000-\u001f\u007f-\u009f]/g, '?');
}
