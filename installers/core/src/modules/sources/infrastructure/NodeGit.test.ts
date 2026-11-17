// The git adapter: first on a recording runner, where the argv and the environment passed to git are asserted (M-04, M-05, M-07), then
// against real local bare repositories, where the policy of the test allows `file` (production keeps https and ssh, DR-609).
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { acquireGit } from '#sources/application/git/acquireGit.ts';
import { createNodeGit, GIT_RETRY_DELAY_MS, GIT_TIMEOUT_MS } from '#sources/infrastructure/NodeGit.ts';
import { buildGitEnvironment } from '#sources/infrastructure/gitEnvironment.ts';
import { runGit, type GitInvocation, type GitRun } from '#sources/infrastructure/gitRunner.ts';
import { createNodeSourceDisk } from '#sources/infrastructure/NodeSourceDisk.ts';

const production = { allowedProtocols: ['https', 'ssh'] } as const;
const ok = (stdout = ''): GitRun => ({ code: 0, stdout, stderr: '', timedOut: false });
const COMMIT = 'a'.repeat(40);

function recording(answers: GitRun[]): {
  invocations: GitInvocation[];
  sleeps: number[];
  git: ReturnType<typeof createNodeGit>;
} {
  const invocations: GitInvocation[] = [];
  const sleeps: number[] = [];
  const pending = [...answers];
  const git = createNodeGit({
    policy: production,
    environment: {
      PATH: '/usr/bin',
      HOME: '/home/v',
      GIT_SSH_COMMAND: 'evil',
      GIT_EXEC_PATH: '/evil',
      GIT_CONFIG_COUNT: '1',
      GIT_CONFIG_KEY_0: 'core.sshCommand',
      SECRET_TOKEN: 'x',
    },
    run: (invocation) => {
      invocations.push(invocation);
      return Promise.resolve(pending.shift() ?? ok());
    },
    sleep: (milliseconds) => {
      sleeps.push(milliseconds);
      return Promise.resolve();
    },
  });
  return { invocations, sleeps, git };
}

const request = { component: 'kb', url: 'https://example.invalid/kb.git', dest: '/home/v/.agent-config/components/kb' };

// What stands in front of every subcommand: links off, no file system monitor, no hook, no git-lfs filter (M-04, M-05, M-18).
const SAFE = [
  '-c',
  'core.symlinks=false',
  '-c',
  'core.fsmonitor=false',
  '-c',
  `core.hooksPath=${os.devNull}`,
  '-c',
  'filter.lfs.smudge=',
  '-c',
  'filter.lfs.process=',
  '-c',
  'filter.lfs.required=false',
];
const FSCK = ['-c', 'transfer.fsckObjects=true'];

describe('M-04, M-05 the arguments passed to git, complete', () => {
  it('clone: links off, no hooks, no templates, no lfs, fsck, no checkout, no submodules, the address and folder after `--`', async () => {
    const { invocations, git } = recording([ok()]);
    await git.clone({ ...request, dest: '/tmp/never-existing-dest-for-test' });
    const args = invocations[0]!.args;
    expect(args).toEqual([
      ...SAFE,
      ...FSCK,
      'clone',
      '--template=',
      '--no-checkout',
      '--no-recurse-submodules',
      '--config',
      'core.symlinks=false',
      '--',
      request.url,
      '/tmp/never-existing-dest-for-test',
    ]);
    expect(args.indexOf('--')).toBeLessThan(args.indexOf(request.url));
  });

  it('fetch: exactly these arguments, with the address after `--` and then only the two refspecs', async () => {
    const { invocations, git } = recording([ok()]);
    await git.fetch(request);
    expect(invocations[0]!.args).toEqual([
      '-C',
      request.dest,
      ...SAFE,
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
    ]);
  });

  it('rev-parse: exactly these arguments, verified, one name after --end-of-options; answers a full commit id only', async () => {
    const { invocations, git } = recording([ok(`${COMMIT}\n`), ok('not a commit\n'), ok(`${COMMIT}\n`)]);
    await expect(git.revParse(request.dest, 'refs/tags/v1^{commit}')).resolves.toBe(COMMIT);
    expect(invocations[0]!.args).toEqual([
      '-C',
      request.dest,
      ...SAFE,
      'rev-parse',
      '--verify',
      '--quiet',
      '--end-of-options',
      'refs/tags/v1^{commit}',
    ]);
    await expect(git.revParse(request.dest)).rejects.toThrow('commit id');
    await git.revParse(request.dest);
    expect(invocations[2]!.args.slice(-1)).toEqual(['HEAD']);
  });

  it('checkout: exactly these arguments, detached, forced, no submodules, a full commit id followed by `--`', async () => {
    const { invocations, git } = recording([ok()]);
    await git.checkout({ ...request, ref: COMMIT });
    expect(invocations[0]!.args).toEqual([
      '-C',
      request.dest,
      ...SAFE,
      'checkout',
      '--detach',
      '--force',
      '--no-recurse-submodules',
      COMMIT,
      '--',
    ]);
    await expect(git.checkout({ ...request, ref: 'main' })).rejects.toThrow('full commit id');
    await expect(git.checkout({ ...request, ref: '--orphan' })).rejects.toThrow();
    expect(invocations).toHaveLength(1);
  });

  it('the hooks path can be chosen by the composition root', async () => {
    const invocations: GitInvocation[] = [];
    const adapter = createNodeGit({
      policy: production,
      environment: {},
      hooksPath: '/home/v/.agent-config/empty-hooks',
      run: (invocation) => {
        invocations.push(invocation);
        return Promise.resolve(ok());
      },
    });
    await adapter.fetch(request);
    expect(invocations[0]!.args).toContain('core.hooksPath=/home/v/.agent-config/empty-hooks');
  });

  it.each([['relative/clone'], ['-oProxyCommand=x'], ['']])(
    'refuses the folder %j before any git runs',
    async (dest) => {
      const { invocations, git } = recording([ok()]);
      await expect(git.fetch({ ...request, dest })).rejects.toThrow('absolute');
      await expect(git.clone({ ...request, dest })).rejects.toThrow('absolute');
      await expect(git.revParse(dest)).rejects.toThrow('absolute');
      expect(invocations).toEqual([]);
    },
  );

  it('the time limit is 60 seconds and each call has one', async () => {
    const { invocations, git } = recording([ok()]);
    await git.fetch(request);
    expect(GIT_TIMEOUT_MS).toBe(60_000);
    expect(invocations[0]!.timeoutMs).toBe(60_000);
  });
});

describe('M-05, M-07 the environment passed to git', () => {
  it('has GIT_ALLOW_PROTOCOL from the policy, no prompt, no lfs smudge, and nothing of the caller beyond the allow-list', async () => {
    const { invocations, git } = recording([ok()]);
    await git.fetch(request);
    expect(invocations[0]!.env).toEqual({
      PATH: '/usr/bin',
      HOME: '/home/v',
      GIT_ALLOW_PROTOCOL: 'https:ssh',
      GIT_TERMINAL_PROMPT: '0',
      LC_ALL: 'C',
      GIT_LFS_SKIP_SMUDGE: '1',
    });
  });

  it.each([
    ['GIT_CONFIG_COUNT', '1'],
    ['GIT_CONFIG_KEY_0', 'core.sshCommand'],
    ['GIT_CONFIG_VALUE_0', 'touch marker'],
    ['GIT_CONFIG_GLOBAL', '/tmp/other-config'],
    ['GIT_CONFIG_SYSTEM', '/tmp/other-config'],
    ['GIT_CONFIG_PARAMETERS', "'core.sshcommand=touch marker'"],
    ['GIT_CONFIG_NOSYSTEM', '0'],
    ['GIT_SSH_COMMAND', 'touch marker'],
    ['GIT_EXEC_PATH', '/evil'],
    ['GIT_TEMPLATE_DIR', '/evil'],
  ])('production passes %s on to nobody', (name, value) => {
    const env = buildGitEnvironment({ PATH: '/usr/bin', [name]: value }, production);
    expect(Object.keys(env)).not.toContain(name);
  });

  it('a GIT_CONFIG_* name given on purpose as `extra` reaches git, beside the fixed policy', () => {
    const env = buildGitEnvironment({}, production, {
      GIT_CONFIG_COUNT: '1',
      GIT_CONFIG_KEY_0: 'url.x.insteadOf',
      GIT_CONFIG_VALUE_0: 'https://example.invalid/',
    });
    expect(env).toMatchObject({ GIT_CONFIG_COUNT: '1', GIT_ALLOW_PROTOCOL: 'https:ssh', GIT_LFS_SKIP_SMUDGE: '1' });
  });

  it.each([
    ['GIT_ALLOW_PROTOCOL', 'file'],
    ['GIT_LFS_SKIP_SMUDGE', '0'],
  ])('M-05 `extra` cannot change the fixed name %s', (name, value) => {
    expect(() => buildGitEnvironment({}, production, { [name]: value })).toThrow(/only GIT_CONFIG_COUNT/);
  });

  it.each([
    'GIT_CONFIG_GLOBAL',
    'GIT_CONFIG_SYSTEM',
    'GIT_CONFIG_PARAMETERS',
    'GIT_SSH_COMMAND',
    'GIT_CONFIG_KEY_x',
    'PATH',
  ])('M-05 `extra` may not add %s', (name) => {
    expect(() => buildGitEnvironment({}, production, { [name]: '/tmp/x' })).toThrow(/only GIT_CONFIG_COUNT/);
  });

  it('the adapter gives its extra names to git', async () => {
    const invocations: GitInvocation[] = [];
    const adapter = createNodeGit({
      policy: production,
      environment: { PATH: '/usr/bin' },
      extraEnvironment: { GIT_CONFIG_COUNT: '1' },
      run: (invocation) => {
        invocations.push(invocation);
        return Promise.resolve(ok());
      },
    });
    await adapter.fetch(request);
    expect(invocations[0]!.env['GIT_CONFIG_COUNT']).toBe('1');
  });

  it.each([
    [['https', 'ssh'], 'https:ssh'],
    [['https', 'ssh', 'file'], 'https:ssh:file'],
    [['ssh'], 'ssh'],
  ])('policy %j gives GIT_ALLOW_PROTOCOL=%s', (allowedProtocols, expected) => {
    expect(buildGitEnvironment({}, { allowedProtocols }).GIT_ALLOW_PROTOCOL).toBe(expected);
  });

  it('a caller GIT_ALLOW_PROTOCOL or GIT_TERMINAL_PROMPT cannot widen the policy', () => {
    const env = buildGitEnvironment(
      { GIT_ALLOW_PROTOCOL: 'file:ext', GIT_TERMINAL_PROMPT: '1', LC_ALL: 'de' },
      production,
    );
    expect(env).toMatchObject({ GIT_ALLOW_PROTOCOL: 'https:ssh', GIT_TERMINAL_PROMPT: '0', LC_ALL: 'C' });
  });
});

describe('M-05 retries and the time limit', () => {
  const network = {
    code: 128,
    stdout: '',
    stderr: 'fatal: unable to access: Could not resolve host: example.invalid',
    timedOut: false,
  };

  it('retries once after two seconds on a network error and succeeds', async () => {
    const { invocations, sleeps, git } = recording([network, ok()]);
    await git.fetch(request);
    expect(invocations).toHaveLength(2);
    expect(sleeps).toEqual([GIT_RETRY_DELAY_MS, ...[]].slice(0, 1));
    expect(GIT_RETRY_DELAY_MS).toBe(2_000);
  });

  it('retries only once', async () => {
    const { invocations, git } = recording([network, network, ok()]);
    const error: unknown = await git.fetch(request).catch((caught: unknown) => caught);
    expect((error as { stderr: string }).stderr).toContain('Could not resolve host');
    expect(invocations).toHaveLength(2);
  });

  it('does not retry a repository that is not there', async () => {
    const { invocations, sleeps, git } = recording([
      { code: 128, stdout: '', stderr: "fatal: repository 'x' not found", timedOut: false },
    ]);
    await expect(git.fetch(request)).rejects.toThrow();
    expect(invocations).toHaveLength(1);
    expect(sleeps).toEqual([]);
  });

  it('retries a call the time limit stopped, and says so when it fails again', async () => {
    const stopped = { code: null, stdout: '', stderr: '', timedOut: true };
    const { invocations, git } = recording([stopped, stopped]);
    await expect(git.fetch(request)).rejects.toMatchObject({ timedOut: true, message: 'git did not finish in time' });
    expect(invocations).toHaveLength(2);
  });
});

// ---- against real git and local bare repositories ----------------------------------------------------------------------

let temp = '';
beforeEach(() => {
  temp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'sources-git-')));
});
afterEach(() => {
  fs.rmSync(temp, { recursive: true, force: true });
});

const isolated = (): Record<string, string> => {
  const config = path.join(temp, 'gitconfig');
  fs.writeFileSync(config, '');
  return {
    PATH: process.env['PATH'] ?? '',
    HOME: temp,
    GIT_CONFIG_GLOBAL: config,
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_AUTHOR_NAME: 'T',
    GIT_AUTHOR_EMAIL: 't@example.invalid',
    GIT_COMMITTER_NAME: 'T',
    GIT_COMMITTER_EMAIL: 't@example.invalid',
    // The same files give the same commit ids on every machine.
    GIT_AUTHOR_DATE: '2026-01-01T00:00:00Z',
    GIT_COMMITTER_DATE: '2026-01-01T00:00:00Z',
  };
};

function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', ['-C', cwd, ...args], { env: isolated(), encoding: 'utf8' }).trim();
}

/** A bare repository `src.git` with one commit that holds a file, a link and a .gitmodules. */
function makeSource(): { bare: string; work: string } {
  const bare = path.join(temp, 'src.git');
  const work = path.join(temp, 'work');
  execFileSync('git', ['init', '--bare', '--initial-branch=main', '--', bare], { env: isolated() });
  execFileSync('git', ['clone', '--', bare, work], { env: isolated(), stdio: 'ignore' });
  fs.mkdirSync(path.join(work, 'content'));
  fs.writeFileSync(path.join(work, 'content/index.md'), 'one\n');
  fs.symlinkSync('/etc/hostname', path.join(work, 'content/link.md'));
  fs.writeFileSync(
    path.join(work, '.gitmodules'),
    '[submodule "x"]\n  path = x\n  url = https://example.invalid/x.git\n',
  );
  git(work, 'add', '-A');
  git(work, 'commit', '-m', 'one');
  git(work, 'push', 'origin', 'HEAD:main');
  return { bare, work };
}

// The adapter passes HOME on, so git reads the global configuration of the temporary home (none unless a test writes one).
function realGit(policy: { allowedProtocols: readonly string[] } = { allowedProtocols: ['https', 'ssh', 'file'] }) {
  return createNodeGit({ policy, environment: isolated() });
}

const gitAvailable = ((): boolean => {
  try {
    execFileSync('git', ['--version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();

// A stand-in for ssh that never answers, so the time limit is what ends the call.
function slowSsh(): string {
  const script = path.join(temp, 'slow-ssh');
  fs.writeFileSync(script, '#!/bin/sh\nsleep 5\n', { mode: 0o755 });
  return script;
}

describe.skipIf(process.platform === 'win32' || !gitAvailable)(
  'the real adapter against local bare repositories',
  () => {
    it('clones without checking out, resolves a branch, checks out detached, and turns a link into a plain file (M-04)', async () => {
      const { bare } = makeSource();
      const dest = path.join(temp, 'clone');
      const adapter = realGit();
      const url = `file://${bare}`;
      await adapter.clone({ component: 'kb', url, dest });
      expect(fs.existsSync(path.join(dest, 'content'))).toBe(false);
      const commit = await adapter.revParse(dest, 'refs/remotes/origin/main^{commit}');
      expect(commit).toMatch(/^[0-9a-f]{40}$/);
      await adapter.checkout({ component: 'kb', url, dest, ref: commit });
      expect(fs.readFileSync(path.join(dest, 'content/index.md'), 'utf8')).toBe('one\n');
      expect(fs.lstatSync(path.join(dest, 'content/link.md')).isSymbolicLink()).toBe(false);
      expect(fs.readFileSync(path.join(dest, 'content/link.md'), 'utf8')).toBe('/etc/hostname');
      expect(fs.existsSync(path.join(dest, 'x'))).toBe(false);
      expect(git(dest, 'config', '--get', 'core.symlinks')).toBe('false');
    });

    it('M-05 the production policy refuses a file address, leaves no folder, and never starts the clone', async () => {
      const { bare } = makeSource();
      const dest = path.join(temp, 'clone');
      const error: unknown = await realGit(production)
        .clone({ component: 'kb', url: `file://${bare}`, dest })
        .catch((caught: unknown) => caught);
      expect((error as { stderr: string }).stderr).toMatch(/not allowed/i);
      expect(fs.existsSync(dest)).toBe(false);
    });

    it('M-05 an option-looking address is a repository name after `--`, never an option', async () => {
      const dest = path.join(temp, 'clone');
      await expect(realGit().clone({ component: 'kb', url: '-oProxyCommand=touch marker', dest })).rejects.toThrow();
      expect(fs.existsSync(path.join(temp, 'marker'))).toBe(false);
      expect(fs.existsSync(dest)).toBe(false);
    });

    it('a failed clone does not remove a folder that was already there', async () => {
      const dest = path.join(temp, 'clone');
      fs.mkdirSync(dest);
      fs.writeFileSync(path.join(dest, 'keep.txt'), 'mine');
      await expect(
        realGit().clone({ component: 'kb', url: `file://${path.join(temp, 'missing.git')}`, dest }),
      ).rejects.toThrow();
      expect(fs.readFileSync(path.join(dest, 'keep.txt'), 'utf8')).toBe('mine');
    });

    it('fetch sees a tag that moved at the source', async () => {
      const { bare, work } = makeSource();
      git(work, 'tag', 'v1.0.0');
      git(work, 'push', 'origin', 'v1.0.0');
      const dest = path.join(temp, 'clone');
      const adapter = realGit();
      const url = `file://${bare}`;
      await adapter.clone({ component: 'kb', url, dest });
      const before = await adapter.revParse(dest, 'refs/tags/v1.0.0^{commit}');
      fs.writeFileSync(path.join(work, 'content/index.md'), 'two\n');
      git(work, 'commit', '-am', 'two');
      git(work, 'tag', '-f', 'v1.0.0');
      git(work, 'push', '--force', 'origin', 'HEAD:main', 'refs/tags/v1.0.0');
      await adapter.fetch({ component: 'kb', url, dest });
      expect(await adapter.revParse(dest, 'refs/tags/v1.0.0^{commit}')).not.toBe(before);
    });

    it('M-05, M-18 no hook runs: not one of core.hooksPath in the user configuration, nor one copied from init.templateDir', async () => {
      const { bare } = makeSource();
      const marker = path.join(temp, 'hook-ran');
      const hook = '#!/bin/sh\ntouch ' + marker + '\n';
      const hooks = path.join(temp, 'user-hooks');
      const templates = path.join(temp, 'templates');
      fs.mkdirSync(hooks);
      fs.mkdirSync(path.join(templates, 'hooks'), { recursive: true });
      for (const folder of [hooks, path.join(templates, 'hooks')]) {
        fs.writeFileSync(path.join(folder, 'post-checkout'), hook, { mode: 0o755 });
      }
      // The user's own ~/.gitconfig: HOME is the temporary folder, which the adapter passes on.
      const config = path.join(temp, '.gitconfig');
      fs.writeFileSync(config, `[core]\n  hooksPath = ${hooks}\n[init]\n  templateDir = ${templates}\n`);
      // The control: plain git with this configuration does run the hook, so the test below proves something.
      execFileSync('git', ['clone', '--', bare, path.join(temp, 'control')], {
        env: { ...isolated(), GIT_CONFIG_GLOBAL: config },
        stdio: 'ignore',
      });
      expect(fs.existsSync(marker)).toBe(true);
      fs.rmSync(marker);
      const adapter = realGit();
      const dest = path.join(temp, 'clone');
      const url = `file://${bare}`;
      await adapter.clone({ component: 'kb', url, dest });
      const commit = await adapter.revParse(dest, 'refs/remotes/origin/main^{commit}');
      await adapter.checkout({ component: 'kb', url, dest, ref: commit });
      await adapter.fetch({ component: 'kb', url, dest });
      expect(fs.existsSync(marker)).toBe(false);
      expect(fs.existsSync(path.join(dest, '.git', 'hooks', 'post-checkout'))).toBe(false);
    });

    it('M-05 a GIT_CONFIG_KEY_0 of the caller that sets core.sshCommand is not passed on', async () => {
      const marker = path.join(temp, 'ssh-ran');
      const script = path.join(temp, 'my-ssh');
      fs.writeFileSync(script, `#!/bin/sh\ntouch ${marker}\nexit 1\n`, { mode: 0o755 });
      const adapter = createNodeGit({
        policy: production,
        environment: {
          ...isolated(),
          GIT_CONFIG_COUNT: '1',
          GIT_CONFIG_KEY_0: 'core.sshCommand',
          GIT_CONFIG_VALUE_0: script,
        },
      });
      await expect(
        adapter.clone({ component: 'kb', url: 'ssh://example.invalid/x.git', dest: path.join(temp, 'c') }),
      ).rejects.toThrow();
      expect(fs.existsSync(marker)).toBe(false);
    });

    it('a call that outlives the time limit is stopped and reported as timed out', async () => {
      const run = await runGit({
        args: ['clone', '--', 'ssh://example.invalid/x.git', path.join(temp, 'never')],
        env: { ...isolated(), GIT_SSH_COMMAND: slowSsh(), GIT_ALLOW_PROTOCOL: 'ssh' },
        timeoutMs: 300,
      });
      expect(run.timedOut).toBe(true);
      expect(run.code).toBeNull();
    });

    it('acquireGit end to end: first install, a plain install that stays, an update that advances, submodules warned', async () => {
      const { bare, work } = makeSource();
      const deps = {
        git: realGit(),
        disk: createNodeSourceDisk(),
        gitPolicy: { allowedProtocols: ['https', 'ssh', 'file'] },
        flavor: 'posix',
      } as const;
      const dest = path.join(temp, 'components-kb');
      const base = { name: 'kb', url: `file://${bare}`, ref: 'main', dest, update: false } as const;
      const first = await acquireGit(deps, { ...base, locked: undefined });
      expect(fs.readdirSync(dest)).toContain('.gitmodules');
      expect(first).toMatchObject({ kind: 'acquired', advancedFrom: undefined, submodules: true });
      const commit = first.kind === 'acquired' ? first.commit : '';
      fs.writeFileSync(path.join(work, 'content/index.md'), 'two\n');
      git(work, 'commit', '-am', 'two');
      git(work, 'push', 'origin', 'HEAD:main');
      const plain = await acquireGit(deps, { ...base, locked: { commit } });
      expect(plain).toMatchObject({ kind: 'acquired', commit, advancedFrom: undefined });
      expect(fs.readFileSync(path.join(dest, 'content/index.md'), 'utf8')).toBe('one\n');
      fs.rmSync(bare, { recursive: true, force: true });
      expect(await acquireGit(deps, { ...base, locked: { commit } })).toMatchObject({ kind: 'acquired', commit });
      const gone = await acquireGit(deps, { ...base, locked: { commit }, update: true });
      expect(gone).toMatchObject({ kind: 'fetch-failed', name: 'kb', ref: 'main' });
      expect(fs.readFileSync(path.join(dest, 'content/index.md'), 'utf8')).toBe('one\n');
    });
  },
);
