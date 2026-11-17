import { isProtocolAllowed } from '#manifests/application/ListOperations.ts';
import type { SourcesDeps } from '#sources/application/SourcesDeps.ts';
import type { GitRequest } from '#sources/application/ports/GitPort.ts';
import type {
  GitAcquired,
  GitAcquireRequest,
  GitAcquireResult,
  GitFetchFailed,
  GitRefused,
} from '#sources/domain/model/Acquisition.ts';
import { addressHoldsCredentials, checkGitSourceText } from '#sources/domain/rules/sourceText.ts';
import path from 'node:path';

const COMMIT = /^[0-9a-f]{40}$/;
const CAUSE_LIMIT = 400;

// One line of what git said: white space collapsed so a multi-line message prints as one line, cut at a length that fits a terminal.
// The text is printed only through MG-32.cause, which hides credentials and shows control characters (M-07, M-11).
function causeOf(error: unknown): string {
  const record = typeof error === 'object' && error !== null ? (error as Record<string, unknown>) : {};
  if (record['timedOut'] === true) return 'git did not finish in time';
  const text = [record['stderr'], record['message']].find((each) => typeof each === 'string' && each.trim() !== '');
  const line = (typeof text === 'string' ? text : 'git failed').replace(/\s+/g, ' ').trim();
  return line.length > CAUSE_LIMIT ? `${line.slice(0, CAUSE_LIMIT)}...` : line;
}

interface Run {
  readonly deps: SourcesDeps;
  readonly request: GitAcquireRequest;
  readonly git: GitRequest;
}

function failed(run: Run, cause: string): GitFetchFailed {
  const { name, url, ref } = run.request;
  return { kind: 'fetch-failed', name, url, ref, cause };
}

// The commit a ref names in the clone: a tag first, so a pinned tag is a tag even when a branch has the same name, then the branch
// of the source, then a commit id. `undefined` when the clone has none of them.
async function resolveRef(
  run: Run,
): Promise<{ readonly commit: string; readonly tag: string | undefined } | undefined> {
  const { git } = run.deps;
  const { ref, dest } = run.request;
  for (const [name, isTag] of [
    [`refs/tags/${ref}^{commit}`, true],
    [`refs/remotes/origin/${ref}^{commit}`, false],
    [`${ref}^{commit}`, false],
  ] as const) {
    const commit = await git.revParse(dest, name).catch(() => undefined);
    if (commit !== undefined && COMMIT.test(commit)) return { commit, tag: isTag ? ref : undefined };
  }
  return undefined;
}

async function hasCommit(run: Run, commit: string): Promise<boolean> {
  const found = await run.deps.git.revParse(run.request.dest, `${commit}^{commit}`).catch(() => undefined);
  return found === commit;
}

// Whether this run must fetch before it can decide: always for `install --update`; for a pinned tag, to see whether it moved
// (M-02); and when the clone lacks the locked commit. A plain run of a branch with a lock fetches nothing (AC-3.1, EDGE-9).
async function needsFetch(run: Run): Promise<'must' | 'try' | 'no'> {
  const { locked, update } = run.request;
  if (update || locked === undefined) return 'must';
  if (!(await hasCommit(run, locked.commit))) return 'must';
  return locked.tag === undefined ? 'no' : 'try';
}

// What a pinned tag names after a successful fetch: its commit, or why it names none (M-02). A tag that is missing, or that points at
// something that is not a commit, is as much a moved tag as one that points elsewhere: the locked commit is no longer what the tag says.
async function tagNow(run: Run, tag: string): Promise<string> {
  const { git } = run.deps;
  const commit = await git.revParse(run.request.dest, `refs/tags/${tag}^{commit}`).catch(() => undefined);
  if (commit !== undefined && COMMIT.test(commit)) return commit;
  const exists = await git.revParse(run.request.dest, `refs/tags/${tag}`).catch(() => undefined);
  return exists === undefined ? 'gone' : 'not a commit';
}

async function settleTarget(
  run: Run,
  fetched: boolean,
): Promise<GitAcquireResult | { readonly commit: string; readonly tag: string | undefined }> {
  const { locked, update, name } = run.request;
  if (locked === undefined || update) {
    return (await resolveRef(run)) ?? failed(run, 'the ref is not in the source');
  }
  if (locked.tag !== undefined && fetched) {
    const current = await tagNow(run, locked.tag);
    if (current !== locked.commit) return { kind: 'tag-moved', name, tag: locked.tag, locked: locked.commit, current };
  }
  if (!(await hasCommit(run, locked.commit))) return failed(run, 'the locked commit is not in the source');
  return { commit: locked.commit, tag: locked.tag };
}

// A clone made with `--no-checkout` already has a HEAD, so HEAD alone does not say the tree is there: git writes `.git/index` at the
// first checkout, and a run that stopped between the clone and the checkout leaves none. The clone is put on the commit unless both
// HEAD and the index say it already is.
async function putOnCommit(run: Run, commit: string): Promise<string | undefined> {
  const { git, disk, flavor } = run.deps;
  const head = await git.revParse(run.request.dest).catch(() => undefined);
  const indexed = disk.exists(path[flavor].join(run.request.dest, '.git', 'index')) === true;
  if (head === commit && indexed) return undefined;
  try {
    await git.checkout({ ...run.git, ref: commit });
    return undefined;
  } catch (error) {
    return causeOf(error);
  }
}

/**
 * Brings the managed clone of a git source to the commit this run uses and says which commit that is (FR-020, M-02, M-04, M-05).
 *
 * A plain `install` stays on the commit the lock holds: a branch with a lock is not even fetched, so it works with the network
 * down (EDGE-9); a pinned tag is fetched to see whether it moved, and a moved tag stops the run (AC-3.10). Only `install --update`
 * advances a source, and a source that cannot be fetched leaves the clone as it was (AC-3.4). A first install clones and takes the
 * commit the ref names. The answer is data: the commands print MG-14, MG-15, MG-22, MG-29 or MG-32 from it.
 *
 * @param deps - the git program, the disk, the git policy and the path syntax
 * @param request - the component, its address and ref, the clone folder, the lock entry and whether this is an update
 * @returns the commit now checked out, or why the source could not be used
 */
export async function acquireGit(deps: SourcesDeps, request: GitAcquireRequest): Promise<GitAcquireResult> {
  const { name, url, dest } = request;
  // 1. The text must be something git reads as an address and a ref, and the transport must be allowed (M-05, M-07).
  const refusal = refuseSource(deps, request);
  if (refusal !== undefined) return refusal;
  const run: Run = { deps, request, git: { component: name, url, dest } };
  // 2. A clone that is not there is made; one that is there is fetched when this run needs to know what the source says.
  const folder = deps.disk.folderState(dest);
  if (folder === 'not-folder' || folder === 'unknown') return failed(run, 'the clone path is not a folder');
  const refreshed = folder === 'missing' ? await cloneFresh(run) : await refresh(run);
  if (refreshed.failure !== undefined) return refreshed.failure;
  // 3. Which commit this run uses, then put the clone on it.
  const target = await settleTarget(run, refreshed.fetched);
  if ('kind' in target) return target;
  const checkoutFailure = await putOnCommit(run, target.commit);
  if (checkoutFailure !== undefined) return failed(run, checkoutFailure);
  return acquired(run, target.commit, target.tag);
}

function refuseSource(deps: SourcesDeps, request: GitAcquireRequest): GitRefused | undefined {
  const { name, url, ref, dest } = request;
  const text = checkGitSourceText(url, ref);
  const refused = (reason: string): GitRefused => ({ kind: 'refused', name, reason });
  if (!text.ok) return refused(text.error);
  if (!path[deps.flavor].isAbsolute(dest) || dest.startsWith('-'))
    return refused('the clone folder must be an absolute path');
  return !isProtocolAllowed(deps.gitPolicy, url) || addressHoldsCredentials(url)
    ? refused('the source address uses a transport that is not allowed or holds credentials (M-05, M-07)')
    : undefined;
}

/** What getting the clone up to date did: the failure that stops the run, and whether the source was reached. */
interface Refreshed {
  readonly failure: GitFetchFailed | undefined;
  readonly fetched: boolean;
}

async function cloneFresh(run: Run): Promise<Refreshed> {
  try {
    await run.deps.git.clone(run.git);
    return { failure: undefined, fetched: true };
  } catch (error) {
    return { failure: failed(run, causeOf(error)), fetched: false };
  }
}

async function refresh(run: Run): Promise<Refreshed> {
  const need = await needsFetch(run);
  if (need === 'no') return { failure: undefined, fetched: false };
  try {
    await run.deps.git.fetch(run.git);
    return { failure: undefined, fetched: true };
  } catch (error) {
    // A tag check is a courtesy: the run stays on the locked commit whatever the network says, so a failed check changes nothing.
    return { failure: need === 'try' ? undefined : failed(run, causeOf(error)), fetched: false };
  }
}

function acquired(run: Run, commit: string, tag: string | undefined): GitAcquired | GitFetchFailed {
  const { name, url, ref, locked, dest } = run.request;
  const submodules = run.deps.disk.exists(path[run.deps.flavor].join(dest, '.gitmodules'));
  return {
    kind: 'acquired',
    name,
    url,
    ref,
    commit,
    tag,
    advancedFrom: locked !== undefined && locked.commit !== commit ? locked.commit : undefined,
    submodules: submodules !== false,
  };
}
