// M-03 and M-04 on a disk that is only a table: which paths exist and which are links. The probe follows links the way a real file
// system does (segment by segment, at most 20 hops), so a link inside the root that points out is seen exactly as it would be.
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { LinkAnswer, PathProbe, RealPathAnswer } from '#shared/application/containment/PathProbe.ts';
import {
  resolveContainedPath,
  type ContainedPath,
  type ContainmentRequest,
} from '#shared/application/containment/resolveContainedPath.ts';
import type { PathFlavor } from '#shared/domain/path/PathContainment.ts';

interface FakeDisk {
  /** Folders and files that exist. */
  readonly present: readonly string[];
  /** Links, by link path, with the path they point at. */
  readonly links: Readonly<Record<string, string>>;
  /** Paths the disk cannot answer for (no permission, a read error): the probe says `unknown`. */
  readonly unreadable?: readonly string[];
}

function probeOf(disk: FakeDisk, flavor: PathFlavor): PathProbe {
  const flavored = path[flavor];
  const present = new Set(disk.present);
  const unreadable = new Set(disk.unreadable ?? []);
  const resolve = (target: string, hops: number): RealPathAnswer => {
    if (hops > 20) return { kind: 'unknown' }; // ELOOP: too many links, whatever the cause
    let current = flavored.parse(target).root;
    for (const segment of target.slice(current.length).split(/[\\/]/).filter(Boolean)) {
      const next = flavored.join(current, segment);
      if (unreadable.has(next)) return { kind: 'unknown' };
      const linked = disk.links[next];
      const answer: RealPathAnswer =
        linked !== undefined
          ? resolve(linked, hops + 1)
          : present.has(next)
            ? { kind: 'real', path: next }
            : { kind: 'missing' };
      if (answer.kind !== 'real') return answer;
      current = answer.path;
    }
    return { kind: 'real', path: current };
  };
  const isLink = (target: string): LinkAnswer => {
    if (unreadable.has(target)) return 'unknown';
    return disk.links[target] === undefined ? 'not-link' : 'link';
  };
  return { realPath: (target) => resolve(flavored.normalize(target), 0), isLink };
}

const posixHome = '/h/.agent-config';
const posixDisk: FakeDisk = {
  unreadable: [`${posixHome}/private`],
  present: [
    `${posixHome}/private`,
    '/',
    '/h',
    posixHome,
    `${posixHome}/store`,
    `${posixHome}/store/kb`,
    `${posixHome}/store/kb/index.md`,
    '/etc',
    '/etc/passwd',
    '/h/.ssh',
    '/h/other',
  ],
  links: {
    [`${posixHome}/out`]: '/etc',
    [`${posixHome}/up`]: '/h',
    [`${posixHome}/kb`]: `${posixHome}/store/kb`,
    [`${posixHome}/hop1`]: `${posixHome}/hop2`,
    [`${posixHome}/hop2`]: '/h/.ssh',
    [`${posixHome}/gone`]: '/nowhere',
    [`${posixHome}/loop`]: `${posixHome}/loop`,
    [`${posixHome}/loopA`]: `${posixHome}/loopB`,
    [`${posixHome}/loopB`]: `${posixHome}/loopA`,
    [`${posixHome}/store/kb/leak`]: '/etc/passwd',
  },
};

function request(relative: string, extra: Partial<ContainmentRequest> = {}): ContainmentRequest {
  return {
    probe: probeOf(posixDisk, 'posix'),
    root: posixHome,
    relative,
    flavor: 'posix',
    finalSegment: 'follow-link',
    ...extra,
  };
}

describe('M-03 resolveContainedPath accepts', () => {
  it.each([
    ['an existing file', 'store/kb/index.md', `${posixHome}/store/kb/index.md`],
    ['a file that does not exist yet', 'store/kb/new/deep.md', `${posixHome}/store/kb/new/deep.md`],
    ['a link that points inside the root', 'kb/index.md', `${posixHome}/store/kb/index.md`],
    ['a dot segment', './store/./kb', `${posixHome}/store/kb`],
  ])('%s', (_title, relative, expected) => {
    expect(resolveContainedPath(request(relative))).toEqual({
      ok: true,
      value: { realPath: expected, realRoot: posixHome },
    });
  });
});

describe('M-03 and M-04 resolveContainedPath refuses', () => {
  it.each([
    ['a link to a folder outside', 'out/passwd'],
    ['a link to a folder outside, new file below it', 'out/new-file'],
    ['a link to the parent folder', 'up/.ssh/authorized_keys'],
    ['a link that is the final segment and points out', 'out'],
    ['a chain of two links that ends outside', 'hop1/x'],
    ['a link inside the tree whose target is a file outside', 'store/kb/leak'],
    ['a dangling link', 'gone'],
    ['a new file below a dangling link', 'gone/x'],
    ['dot dot', '../.ssh/authorized_keys'],
    ['dot dot in the middle', 'store/../../x'],
    ['an absolute path', '/etc/passwd'],
    ['a Windows drive letter', 'C:\\Windows'],
    ['a UNC path', '\\\\server\\share\\x'],
    ['a UNC look-alike with slashes', '//server/share/x'],
    ['a NUL', 'store\0/x'],
  ])('%s', (_title, relative) => {
    const result = resolveContainedPath(request(relative));
    expect(result.ok).toBe(false);
  });

  it('M-04 never repeats the refused path in its reason', () => {
    const result = resolveContainedPath(request('out/secret-s3cr3t-name'));
    expect(JSON.stringify(result)).not.toContain('s3cr3t');
  });

  it.each([
    ['a link that points at itself', 'loop'],
    ['a two-folder link loop', 'loopA/x'],
    ['an unreadable folder', 'private/x'],
  ])('SEC-R1 cannot check %s, so it refuses and does not say the link points at nothing', (_title, relative) => {
    const result = resolveContainedPath(request(relative, { finalSegment: 'follow-link' }));
    expect(result).toMatchObject({ ok: false, error: { kind: 'cannot-check' } });
    expect(JSON.stringify(result)).toMatch(/cannot be checked/);
    expect(JSON.stringify(result)).not.toMatch(/points at nothing/);
  });

  it('refuses a root that does not exist', () => {
    expect(resolveContainedPath(request('a', { root: '/missing/root' })).ok).toBe(false);
  });
});

describe('M-03 resolveContainedPath with keep-link, as uninstall uses it', () => {
  it('accepts a link that points outside, because the link itself is inside the root', () => {
    expect(resolveContainedPath(request('out', { finalSegment: 'keep-link' }))).toEqual({
      ok: true,
      value: { realPath: `${posixHome}/out`, realRoot: posixHome },
    });
  });

  it('still refuses a path that goes through a link out of the root before the last segment', () => {
    expect(resolveContainedPath(request('out/passwd', { finalSegment: 'keep-link' })).ok).toBe(false);
  });

  it('accepts a dangling link as the last segment', () => {
    expect(resolveContainedPath(request('gone', { finalSegment: 'keep-link' })).ok).toBe(true);
  });
});

describe('M-03 resolveContainedPath with a root spelled in another way', () => {
  it.each([
    ['a doubled slash', '/h//.agent-config', 'store/kb/index.md', `${posixHome}/store/kb/index.md`],
    ['a trailing slash', `${posixHome}/`, 'kb/index.md', `${posixHome}/store/kb/index.md`],
    ['a dot segment', '/h/./.agent-config', 'store', `${posixHome}/store`],
  ])('accepts %s', (_title, root, relative, expected) => {
    expect(resolveContainedPath(request(relative, { root }))).toMatchObject({
      ok: true,
      value: { realPath: expected, realRoot: posixHome },
    });
  });

  it.each([
    ['the root itself', '.', posixHome],
    ['the root itself, with a doubled slash in the root', '.', '/h//.agent-config'],
    ['the root itself, with a trailing slash in the root', './', `${posixHome}/`],
  ])('refuses %s with keep-link, which needs a link inside the root', (_title, relative, root) => {
    expect(resolveContainedPath(request(relative, { root, finalSegment: 'keep-link' }))).toMatchObject({ ok: false });
  });
});

describe('M-03 resolveContainedPath on Windows paths', () => {
  const home = 'C:\\Users\\v\\.agent-config';
  const disk: FakeDisk = {
    present: ['C:\\', 'C:\\Users', 'C:\\Users\\v', home, `${home}\\store`, 'D:\\', 'D:\\evil'],
    links: { [`${home}\\out`]: 'D:\\evil', [`${home}\\in`]: `${home}\\store` },
  };
  const windows = (relative: string): ContainmentRequest => ({
    probe: probeOf(disk, 'win32'),
    root: home,
    relative,
    flavor: 'win32',
    finalSegment: 'follow-link',
  });

  it('accepts a link that stays inside', () => {
    expect(resolveContainedPath(windows('in/x'))).toMatchObject({ ok: true, value: { realPath: `${home}\\store\\x` } });
  });

  it('accepts a root written with a forward slash and mixed separators', () => {
    const mixed = { ...windows('in/x'), root: 'C:/Users\\v/.agent-config' };
    expect(resolveContainedPath(mixed)).toMatchObject({ ok: true, value: { realPath: `${home}\\store\\x` } });
  });

  it.each(['.', './'])('refuses the root itself (%s) with keep-link, whatever the spelling of the root', (relative) => {
    const mixed = { ...windows(relative), root: 'C:/Users\\v/.agent-config', finalSegment: 'keep-link' as const };
    expect(resolveContainedPath(mixed)).toMatchObject({ ok: false });
  });

  it.each([
    ['a link to another drive', 'out/x'],
    ['a drive letter', 'D:/evil'],
    ['a UNC path', '\\\\server\\share'],
  ])('refuses %s', (_title, relative) => {
    expect(resolveContainedPath(windows(relative)).ok).toBe(false);
  });
});

describe('M-03 ContainedPath cannot be faked', () => {
  it('is refused by the type checker when written as an object literal', () => {
    // @ts-expect-error the brand key is private to resolveContainedPath.ts, so no literal has it.
    const fake: ContainedPath = { realPath: '/etc/passwd', realRoot: '/etc' };
    expect(fake.realPath).toBe('/etc/passwd');
  });
});
