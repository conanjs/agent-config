// T133 on an in-memory git: a small model of a remote and its clone, so every row of AC-3.1, AC-3.4, AC-3.9, AC-3.10, M-02, EDGE-9
// and M-05 can say which git operations a run did and did not do.
import { describe, expect, it } from 'vitest';
import { acquireGit } from '#sources/application/git/acquireGit.ts';
import { acquirePath, isVersionControlled } from '#sources/application/path/acquirePath.ts';
import type { GitPort } from '#sources/application/ports/GitPort.ts';
import type { SourceDisk } from '#sources/application/ports/SourceDisk.ts';
import type { SourcesDeps } from '#sources/application/SourcesDeps.ts';
import type { GitAcquireRequest } from '#sources/application/SourceTypes.ts';

const hex = (digit: string): string => digit.repeat(40);
const C1 = hex('1');
const C2 = hex('2');
const C3 = hex('3');

/** A remote with branches and tags, and the clone made from it. */
interface World {
  branches: Record<string, string>;
  tags: Record<string, string>;
  clone:
    { known: Set<string>; head: string | undefined; refs: Record<string, string>; checkedOut: boolean } | undefined;
  down: boolean;
  gone: boolean;
  gitmodules: boolean;
  /** Tags that exist at the source but name something that is not a commit. */
  badTags: string[];
  calls: string[];
}

function world(partial: Partial<World> = {}): World {
  return {
    branches: { main: C1 },
    tags: {},
    clone: undefined,
    down: false,
    gone: false,
    gitmodules: false,
    badTags: [],
    calls: [],
    ...partial,
  };
}

function fetchInto(state: World): void {
  const known = new Set([...Object.values(state.branches), ...Object.values(state.tags)]);
  const refs: Record<string, string> = {};
  for (const [name, commit] of Object.entries(state.branches)) refs[`refs/remotes/origin/${name}^{commit}`] = commit;
  for (const [name, commit] of Object.entries(state.tags)) {
    refs[`refs/tags/${name}^{commit}`] = commit;
    refs[`refs/tags/${name}`] = commit;
  }
  // A tag that names a tree or a blob exists as a ref but has no commit behind it.
  for (const name of state.badTags) refs[`refs/tags/${name}`] = 'f'.repeat(40);
  state.clone = {
    known: new Set([...(state.clone?.known ?? []), ...known]),
    head: state.clone?.head,
    refs,
    checkedOut: state.clone?.checkedOut ?? false,
  };
}

function fakeGit(state: World): GitPort {
  const unreachable = (): never => {
    throw Object.assign(new Error('git failed'), {
      stderr: state.gone ? "fatal: repository 'x' not found" : 'fatal: unable to access: Could not resolve host',
    });
  };
  return {
    clone: (request) => {
      state.calls.push(`clone ${request.component}`);
      if (state.down || state.gone) unreachable();
      fetchInto(state);
      return Promise.resolve();
    },
    fetch: (request) => {
      state.calls.push(`fetch ${request.component}`);
      if (state.down || state.gone) unreachable();
      fetchInto(state);
      return Promise.resolve();
    },
    revParse: (_folder, name = 'HEAD') => {
      const clone = state.clone;
      const direct = /^([0-9a-f]{40})\^\{commit\}$/.exec(name)?.[1];
      const answer =
        name === 'HEAD' ? clone?.head : direct !== undefined && clone?.known.has(direct) ? direct : clone?.refs[name];
      return answer === undefined ? Promise.reject(new Error('unknown revision')) : Promise.resolve(answer);
    },
    checkout: (request) => {
      state.calls.push(`checkout ${request.ref.slice(0, 1)}`);
      if (state.clone === undefined) return Promise.reject(new Error('no clone'));
      state.clone.head = request.ref;
      state.clone.checkedOut = true;
      return Promise.resolve();
    },
  };
}

function deps(state: World, policy: SourcesDeps['gitPolicy'] = { allowedProtocols: ['https', 'ssh'] }): SourcesDeps {
  const disk: SourceDisk = {
    folderState: () => (state.clone === undefined ? 'missing' : 'folder'),
    exists: (target) =>
      target.endsWith('.gitmodules')
        ? state.gitmodules
        : target.endsWith('.git/index')
          ? state.clone?.checkedOut === true
          : false,
  };
  return { git: fakeGit(state), disk, gitPolicy: policy, flavor: 'posix' };
}

const request = (extra: Partial<GitAcquireRequest> = {}): GitAcquireRequest => ({
  name: 'kb',
  url: 'https://example.invalid/kb.git',
  ref: 'main',
  dest: '/home/.agent-config/components/kb',
  locked: undefined,
  update: false,
  ...extra,
});

describe('AC-3.1 a first install clones and takes the commit the ref names', () => {
  it.each([
    ['a branch', { main: C1 }, {}, 'main', C1, undefined],
    ['a tag', { main: C2 }, { 'v1.0.0': C1 }, 'v1.0.0', C1, 'v1.0.0'],
    ['a tag that shares its name with a branch: the tag wins', { v1: C2 }, { v1: C1 }, 'v1', C1, 'v1'],
    ['a commit id', { main: C1 }, {}, C1, C1, undefined],
  ])('%s', async (_title, branches, tags, ref, commit, tag) => {
    const state = world({ branches, tags });
    const result = await acquireGit(deps(state), request({ ref }));
    expect(result).toMatchObject({ kind: 'acquired', commit, tag, advancedFrom: undefined, submodules: false });
    expect(state.calls).toEqual(['clone kb', `checkout ${commit.slice(0, 1)}`]);
  });

  it('a ref the source does not have is a failure with a cause, and nothing is checked out', async () => {
    const state = world();
    const result = await acquireGit(deps(state), request({ ref: 'no-such-branch' }));
    expect(result).toMatchObject({ kind: 'fetch-failed', cause: 'the ref is not in the source' });
    expect(state.calls).toEqual(['clone kb']);
  });
});

describe('a clone whose checkout never happened', () => {
  it('is checked out even though its HEAD already names the commit', async () => {
    const state = world();
    await acquireGit(deps(state), request());
    state.clone!.checkedOut = false;
    state.calls.length = 0;
    await acquireGit(deps(state), request({ locked: { commit: C1 } }));
    expect(state.calls).toEqual(['checkout 1']);
  });
  it('is left alone when HEAD and the index both say it is on the commit', async () => {
    const state = world();
    await acquireGit(deps(state), request());
    state.calls.length = 0;
    await acquireGit(deps(state), request({ locked: { commit: C1 } }));
    expect(state.calls).toEqual([]);
  });
});

describe('AC-3.1 and M-02 a plain install stays on the lock', () => {
  const locked = { commit: C1 };

  it('does not fetch a branch that has a lock, even when the branch moved or the network is down (EDGE-9)', async () => {
    const state = world();
    await acquireGit(deps(state), request());
    state.calls.length = 0;
    state.branches['main'] = C2;
    state.down = true;
    const result = await acquireGit(deps(state), request({ locked }));
    expect(result).toMatchObject({ kind: 'acquired', commit: C1, advancedFrom: undefined });
    expect(state.calls).toEqual([]);
  });

  it('puts a clone that is on another commit back on the locked one', async () => {
    const state = world({ branches: { main: C2 } });
    await acquireGit(deps(state), request());
    state.calls.length = 0;
    state.clone!.known.add(C1);
    const result = await acquireGit(deps(state), request({ locked }));
    expect(result).toMatchObject({ kind: 'acquired', commit: C1 });
    expect(state.calls).toEqual(['checkout 1']);
  });

  it('fetches when the clone lacks the locked commit, and fails when it is still not there', async () => {
    const state = world({ branches: { main: C2 } });
    await acquireGit(deps(state), request());
    state.calls.length = 0;
    const result = await acquireGit(deps(state), request({ locked }));
    expect(state.calls).toEqual(['fetch kb']);
    expect(result).toMatchObject({ kind: 'fetch-failed' });
    expect(result.kind === 'fetch-failed' && result.cause).toContain('locked commit');
  });

  it('fetches a clone that was deleted, from the source, and takes the locked commit', async () => {
    const state = world({ branches: { main: C2 } });
    state.branches['old'] = C1;
    const result = await acquireGit(deps(state), request({ locked }));
    expect(state.calls[0]).toBe('clone kb');
    expect(result).toMatchObject({ kind: 'acquired', commit: C1 });
  });
});

describe('M-02, AC-3.10 a tag that moved', () => {
  const locked = { commit: C1, tag: 'v1.0.0' };
  const cloned = async (): Promise<World> => {
    const state = world({ tags: { 'v1.0.0': C1 } });
    await acquireGit(deps(state), request({ ref: 'v1.0.0' }));
    state.calls.length = 0;
    return state;
  };

  it('stops the run and names the tag and both commits', async () => {
    const state = await cloned();
    state.tags['v1.0.0'] = C3;
    const result = await acquireGit(deps(state), request({ ref: 'v1.0.0', locked }));
    expect(result).toEqual({ kind: 'tag-moved', name: 'kb', tag: 'v1.0.0', locked: C1, current: C3 });
    expect(state.calls).toEqual(['fetch kb']);
  });

  it.each([
    ['gone from the source', (state: World) => delete state.tags['v1.0.0'], 'gone'],
    [
      'pointing at something that is not a commit',
      (state: World) => {
        delete state.tags['v1.0.0'];
        state.badTags.push('v1.0.0');
      },
      'not a commit',
    ],
  ])('a tag %s is a moved tag, and a branch of the same name does not hide it', async (_title, change, current) => {
    const state = await cloned();
    state.branches['v1.0.0'] = C3;
    change(state);
    const result = await acquireGit(deps(state), request({ ref: 'v1.0.0', locked }));
    expect(result).toEqual({ kind: 'tag-moved', name: 'kb', tag: 'v1.0.0', locked: C1, current });
  });

  it('does not call a tag gone when the source could not be reached', async () => {
    const state = await cloned();
    state.down = true;
    delete state.tags['v1.0.0'];
    const result = await acquireGit(deps(state), request({ ref: 'v1.0.0', locked }));
    expect(result).toMatchObject({ kind: 'acquired', commit: C1 });
  });

  it('is fine when the tag did not move, and the run stays on the lock', async () => {
    const state = await cloned();
    const result = await acquireGit(deps(state), request({ ref: 'v1.0.0', locked }));
    expect(result).toMatchObject({ kind: 'acquired', commit: C1, tag: 'v1.0.0' });
  });

  it('stays on the locked commit when the check cannot reach the network', async () => {
    const state = await cloned();
    state.down = true;
    state.tags['v1.0.0'] = C3;
    const result = await acquireGit(deps(state), request({ ref: 'v1.0.0', locked }));
    expect(result).toMatchObject({ kind: 'acquired', commit: C1 });
  });

  it('is allowed to advance on an explicit update, which prints the range', async () => {
    const state = await cloned();
    state.tags['v1.0.0'] = C3;
    const result = await acquireGit(deps(state), request({ ref: 'v1.0.0', locked, update: true }));
    expect(result).toMatchObject({ kind: 'acquired', commit: C3, advancedFrom: C1 });
  });
});

describe('AC-3.9 only install --update advances', () => {
  it('advances a branch to the commit it names now and reports where it came from', async () => {
    const state = world();
    await acquireGit(deps(state), request());
    state.branches['main'] = C2;
    const result = await acquireGit(deps(state), request({ locked: { commit: C1 }, update: true }));
    expect(result).toMatchObject({ kind: 'acquired', commit: C2, advancedFrom: C1 });
  });

  it('reports no range when nothing new came', async () => {
    const state = world();
    await acquireGit(deps(state), request());
    const result = await acquireGit(deps(state), request({ locked: { commit: C1 }, update: true }));
    expect(result).toMatchObject({ kind: 'acquired', commit: C1, advancedFrom: undefined });
  });
});

describe('AC-3.4 a source that cannot be fetched', () => {
  it.each([
    ['the network is down', { down: true }, 'Could not resolve host'],
    ['the repository is gone', { gone: true }, 'not found'],
  ])('%s: the update fails with the cause and the clone is left as it was', async (_title, change, cause) => {
    const state = world();
    await acquireGit(deps(state), request());
    const before = state.clone!.head;
    Object.assign(state, change);
    const result = await acquireGit(deps(state), request({ locked: { commit: C1 }, update: true }));
    expect(result).toMatchObject({ kind: 'fetch-failed', name: 'kb', ref: 'main' });
    expect(result.kind === 'fetch-failed' && result.cause).toContain(cause);
    expect(state.clone!.head).toBe(before);
  });

  it('a first install from a source that cannot be fetched has nothing to keep', async () => {
    const state = world({ down: true });
    const result = await acquireGit(deps(state), request());
    expect(result.kind).toBe('fetch-failed');
    expect(state.clone).toBeUndefined();
  });

  it('cuts a long multi-line cause to one short line', async () => {
    const state = world();
    const git = fakeGit(state);
    const noisy: SourcesDeps = {
      ...deps(state),
      git: {
        ...git,
        clone: () => Promise.reject(Object.assign(new Error('x'), { stderr: `fatal: first\n${'long '.repeat(200)}` })),
      },
    };
    const result = await acquireGit(noisy, request());
    expect(result.kind === 'fetch-failed' && result.cause).toMatch(/^fatal: first long .{0,400}$/);
    expect(result.kind === 'fetch-failed' && result.cause.length).toBeLessThanOrEqual(403);
    expect(result.kind === 'fetch-failed' && result.cause).not.toContain('\n');
  });

  it('says a time limit stopped git', async () => {
    const state = world();
    const timedOut: SourcesDeps = {
      ...deps(state),
      git: { ...fakeGit(state), clone: () => Promise.reject(Object.assign(new Error('x'), { timedOut: true })) },
    };
    const result = await acquireGit(timedOut, request());
    expect(result).toMatchObject({ kind: 'fetch-failed', cause: 'git did not finish in time' });
  });
});

describe('M-05 submodules', () => {
  it('a clone with .gitmodules installs and says the submodules are ignored', async () => {
    const state = world({ gitmodules: true });
    expect(await acquireGit(deps(state), request())).toMatchObject({ kind: 'acquired', submodules: true });
  });
  it('a clone with no .gitmodules does not', async () => {
    expect(await acquireGit(deps(world()), request())).toMatchObject({ submodules: false });
  });
});

describe('M-05, M-07 a source that is refused before git runs', () => {
  it.each([
    ['an address that starts with a dash', { url: '-oProxyCommand=touch-marker' }],
    ['a ref that starts with a dash', { ref: '-x' }],
    ['an ext transport', { url: 'ext::sh -c touch% marker' }],
    ['a file transport under the production policy', { url: 'file:///tmp/x.git' }],
    ['a local folder as an address', { url: '/tmp/x.git' }],
    ['a relative folder as an address', { url: 'relative/folder' }],
    ['a user and password in the address', { url: 'https://vinh:s3cr3t-fake@example.invalid/kb.git' }],
    ['a user name on https', { url: 'https://vinh@example.invalid/kb.git' }],
    ['a clone folder that is relative', { dest: 'components/kb' }],
    ['a clone folder that starts with a dash', { dest: '-components' }],
  ])('%s', async (_title, change) => {
    const state = world();
    const result = await acquireGit(deps(state), request(change));
    expect(result).toMatchObject({ kind: 'refused', name: 'kb' });
    expect(state.calls).toEqual([]);
    expect(JSON.stringify(result)).not.toMatch(/s3cr3t|vinh|touch/);
  });

  it('a file transport is accepted only when the policy of the run allows it (DR-609)', async () => {
    const state = world();
    const result = await acquireGit(
      deps(state, { allowedProtocols: ['https', 'ssh', 'file'] }),
      request({ url: 'file:///tmp/x.git' }),
    );
    expect(result.kind).toBe('acquired');
  });
});

describe('AC-3.2, AC-3.3 path sources', () => {
  const disk = (
    state: 'folder' | 'not-folder' | 'missing' | 'unknown',
    git: Record<string, boolean | 'unknown'> = {},
  ): SourcesDeps => ({
    ...deps(world()),
    disk: { folderState: () => state, exists: (target) => git[target] ?? false },
  });

  it.each([
    ['a folder', 'folder', 'acquired'],
    ['a missing folder', 'missing', 'missing'],
    ['a file', 'not-folder', 'missing'],
    ['a folder that cannot be read', 'unknown', 'missing'],
  ] as const)('%s', (_title, state, kind) => {
    expect(acquirePath(disk(state), { name: 'notes', path: '/work/notes' })).toMatchObject({ kind, name: 'notes' });
  });

  it('records the folder as the list wrote it', () => {
    expect(acquirePath(disk('folder'), { name: 'notes', path: '/work/notes' })).toEqual({
      kind: 'acquired',
      name: 'notes',
      path: '/work/notes',
    });
  });

  it.each([
    ['in the folder itself', { '/work/notes/.git': true }, true],
    ['in a folder above', { '/work/.git': true }, true],
    ['nowhere', {}, false],
    ['unreadable on the way', { '/work/notes/.git': 'unknown' as const }, 'unknown'],
  ])('version control %s', (_title, git, expected) => {
    expect(isVersionControlled(disk('folder', git), '/work/notes')).toBe(expected);
  });
});
