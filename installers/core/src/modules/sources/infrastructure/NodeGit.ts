// The git adapter (specs/022 T133; M-04, M-05, M-07). Only the composition root chooses it (DR-609). It runs `git` without a shell
// through a runner, with a clean environment and the policy of the run in `GIT_ALLOW_PROTOCOL`; every address and path comes after
// `--`; submodules are never fetched; `core.symlinks` is off, so a link in a repository becomes a plain file holding its target text.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { GitPort, GitRequest } from '#sources/application/ports/GitPort.ts';
import { buildGitEnvironment, type ProtocolPolicy } from '#sources/infrastructure/gitEnvironment.ts';
import { runGit, type GitRun, type GitRunner } from '#sources/infrastructure/gitRunner.ts';

/** The time limit of one git call (M-05). */
export const GIT_TIMEOUT_MS = 60_000;
/** The wait before the one retry after a network error (M-05). */
export const GIT_RETRY_DELAY_MS = 2_000;

const COMMIT = /^[0-9a-f]{40}$/;
// Messages of git for a network that is not there; a missing or refused repository is not on this list and is not retried.
const NETWORK_ERROR =
  /could not resolve host|connection (timed out|refused|reset)|operation timed out|temporary failure in name resolution|network is unreachable|failed to connect|early eof|rpc failed|the remote end hung up/i;

// Options in front of every subcommand. Links become files (M-04), no file system monitor starts (M-06), and nothing of the
// repository, the template directory or the user's own configuration runs: no hook (core.hooksPath points at a path with none),
// no git-lfs filter (M-18, the installer runs no code of a component). Written as `-c`, which wins over every configuration file.
function safeOptions(hooksPath: string): readonly string[] {
  return [
    '-c',
    'core.symlinks=false',
    '-c',
    'core.fsmonitor=false',
    '-c',
    `core.hooksPath=${hooksPath}`,
    '-c',
    'filter.lfs.smudge=',
    '-c',
    'filter.lfs.process=',
    '-c',
    'filter.lfs.required=false',
  ];
}

// Objects that arrive are checked for corruption and for the tricks of a hostile repository (M-05).
const FSCK = ['-c', 'transfer.fsckObjects=true'] as const;

/** How the adapter is wired. */
export interface NodeGitOptions {
  /** The transports git may use; it becomes `GIT_ALLOW_PROTOCOL`. */
  readonly policy: ProtocolPolicy;
  /** The environment of this process; the adapter passes on only what git needs. */
  readonly environment: Readonly<Record<string, string | undefined>>;
  /** Runs git; the real one by default, a recording one in a unit test. */
  readonly run?: GitRunner;
  /** Waits before the retry; the real timer by default. */
  readonly sleep?: (milliseconds: number) => Promise<void>;
  /** The time limit of one call. */
  readonly timeoutMs?: number;
  /** Names added to git's environment on purpose: the test entry's `GIT_CONFIG_*` mapping. Production gives none (M-05). */
  readonly extraEnvironment?: Readonly<Record<string, string>>;
  /** A path that holds no hooks, given to `core.hooksPath` (M-05, M-18); the null device by default. */
  readonly hooksPath?: string;
}

/**
 * The arguments of `git clone`: no checkout, no submodules, links off, the address and the folder after `--`.
 *
 * @param request - the address and the folder
 * @param hooksPath - the path given to `core.hooksPath`
 * @returns the arguments after the program name
 */
export function cloneArguments(request: GitRequest, hooksPath: string): readonly string[] {
  return [
    ...safeOptions(hooksPath),
    ...FSCK,
    'clone',
    '--template=',
    '--no-checkout',
    '--no-recurse-submodules',
    '--config',
    'core.symlinks=false',
    '--',
    request.url,
    request.dest,
  ];
}

/**
 * The arguments of `git fetch`: branches and tags forced, so a moved tag is seen, no submodules, the address after `--`.
 *
 * @param request - the address and the clone
 * @param hooksPath - the path given to `core.hooksPath`
 * @returns the arguments after the program name
 */
export function fetchArguments(request: GitRequest, hooksPath: string): readonly string[] {
  return [
    '-C',
    request.dest,
    ...safeOptions(hooksPath),
    ...FSCK,
    'fetch',
    '--no-recurse-submodules',
    '--force',
    '--prune',
    '--no-write-fetch-head',
    '--',
    request.url,
    '+refs/heads/*:refs/remotes/origin/*',
    '+refs/tags/*:refs/tags/*',
  ];
}

/**
 * The arguments of `git rev-parse`: one name, verified, after `--end-of-options`.
 *
 * @param folder - the clone
 * @param name - the name to resolve
 * @param hooksPath - the path given to `core.hooksPath`
 * @returns the arguments after the program name
 */
export function revParseArguments(folder: string, name: string, hooksPath: string): readonly string[] {
  return ['-C', folder, ...safeOptions(hooksPath), 'rev-parse', '--verify', '--quiet', '--end-of-options', name];
}

/**
 * The arguments of `git checkout`: detached at one commit, forced, no submodules, the commit followed by `--`.
 *
 * @param folder - the clone
 * @param commit - 40 hex characters
 * @param hooksPath - the path given to `core.hooksPath`
 * @returns the arguments after the program name
 */
export function checkoutArguments(folder: string, commit: string, hooksPath: string): readonly string[] {
  return [
    '-C',
    folder,
    ...safeOptions(hooksPath),
    'checkout',
    '--detach',
    '--force',
    '--no-recurse-submodules',
    commit,
    '--',
  ];
}

function failure(run: GitRun): Error {
  return Object.assign(
    new Error(run.timedOut ? 'git did not finish in time' : `git failed with exit code ${String(run.code)}`),
    {
      stderr: run.stderr,
      timedOut: run.timedOut,
    },
  );
}

function requireAbsolute(folder: string): void {
  if (!path.isAbsolute(folder) || folder.startsWith('-')) throw new Error('the folder must be an absolute path');
}

// Runs git with the environment of the run; one retry after a pause, only when git says the network failed or the time limit
// stopped it (M-05). A call that does not end with exit code 0 rejects with what git wrote.
function makeCaller(options: NodeGitOptions): (args: readonly string[]) => Promise<GitRun> {
  const run = options.run ?? runGit;
  const sleep =
    options.sleep ?? ((milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds)));
  const env = buildGitEnvironment(options.environment, options.policy, options.extraEnvironment);
  const once = (args: readonly string[]): Promise<GitRun> =>
    run({ args, env, timeoutMs: options.timeoutMs ?? GIT_TIMEOUT_MS });
  return async (args) => {
    const first = await once(args);
    const retry = first.code !== 0 && (first.timedOut || NETWORK_ERROR.test(first.stderr));
    if (retry) await sleep(GIT_RETRY_DELAY_MS);
    const result = retry ? await once(args) : first;
    if (result.code !== 0) throw failure(result);
    return result;
  };
}

/**
 * Makes the git adapter: the four operations of the Git port over one runner, one environment and one time limit.
 *
 * @param options - the policy, the environment of the process and the replaceable runner and timer
 * @returns the four operations of the Git port
 */
export function createNodeGit(options: NodeGitOptions): GitPort {
  const succeed = makeCaller(options);
  const hooksPath = options.hooksPath ?? os.devNull;
  return {
    async clone(request) {
      requireAbsolute(request.dest);
      const existed = fs.existsSync(request.dest);
      try {
        await succeed(cloneArguments(request, hooksPath));
      } catch (error) {
        // Only a folder this call made is removed; one that was there before is the caller's and is left alone.
        if (!existed) fs.rmSync(request.dest, { recursive: true, force: true });
        throw error;
      }
    },
    async fetch(request) {
      requireAbsolute(request.dest);
      await succeed(fetchArguments(request, hooksPath));
    },
    async revParse(folder, name = 'HEAD') {
      requireAbsolute(folder);
      const commit = (await succeed(revParseArguments(folder, name, hooksPath))).stdout.trim();
      if (!COMMIT.test(commit)) throw new Error('git did not answer with a commit id');
      return commit;
    },
    async checkout(request) {
      requireAbsolute(request.dest);
      if (!COMMIT.test(request.ref)) throw new Error('a checkout needs a full commit id');
      await succeed(checkoutArguments(request.dest, request.ref, hooksPath));
    },
  };
}
