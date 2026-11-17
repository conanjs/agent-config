// Runs the git program, without a shell, with its standard streams piped (never inherited), under a time limit (M-05, M-07).
import { spawn } from 'node:child_process';

/** One call of git. */
export interface GitInvocation {
  /** The arguments, after the program name; every address and path comes after `--`. */
  readonly args: readonly string[];
  /** The whole environment of the call. */
  readonly env: Readonly<Record<string, string>>;
  /** The time limit in milliseconds. */
  readonly timeoutMs: number;
}

/** What a call of git gave. */
export interface GitRun {
  /** The exit code; null when git was stopped by the time limit. */
  readonly code: number | null;
  /** Standard output, cut at one megabyte. */
  readonly stdout: string;
  /** Standard error, cut at 64 KiB; it is printed only through MG-32.cause, which redacts it. */
  readonly stderr: string;
  /** True when the time limit stopped git. */
  readonly timedOut: boolean;
}

/** Runs one call of git; a program that cannot be started rejects. */
export type GitRunner = (invocation: GitInvocation) => Promise<GitRun>;

const STDOUT_LIMIT = 1_048_576;
const STDERR_LIMIT = 65_536;

function collect(stream: NodeJS.ReadableStream, limit: number): () => string {
  const chunks: Buffer[] = [];
  let size = 0;
  stream.on('data', (chunk: Buffer) => {
    if (size < limit) chunks.push(chunk.subarray(0, limit - size));
    size += chunk.length;
  });
  return () => Buffer.concat(chunks).toString('utf8');
}

/**
 * Runs git as `spawn('git', args)` with no shell, no standard input, piped output and a kill after the time limit.
 *
 * @param invocation - the arguments, environment and time limit
 * @returns the run; rejects only when the program cannot be started at all
 */
export const runGit: GitRunner = (invocation) =>
  new Promise((resolve, reject) => {
    const limit = AbortSignal.timeout(invocation.timeoutMs);
    const child = spawn('git', [...invocation.args], {
      env: { ...invocation.env },
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
      windowsHide: true,
      killSignal: 'SIGKILL',
      signal: limit,
    });
    const stdout = collect(child.stdout, STDOUT_LIMIT);
    const stderr = collect(child.stderr, STDERR_LIMIT);
    child.on('error', (error) => {
      // A kill by the time limit also arrives here as an AbortError; any other error means git could not be started.
      if (!limit.aborted) reject(Object.assign(new Error('git could not be started'), { stderr: error.message }));
    });
    child.on('close', (code) => {
      const timedOut = limit.aborted;
      resolve({ code: timedOut ? null : code, stdout: stdout(), stderr: stderr(), timedOut });
    });
  });
