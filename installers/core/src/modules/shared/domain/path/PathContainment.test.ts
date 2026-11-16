// M-03 containment by text: the root, hostile candidates, and the joins. Real links are in resolveContainedPath.test.ts.
import { describe, expect, it } from 'vitest';
import { isSameOrInside, joinUnderRoot, type PathFlavor } from '#shared/domain/path/PathContainment.ts';

type InsideCase = [title: string, flavor: PathFlavor, root: string, candidate: string, expected: boolean];

const insideCases: InsideCase[] = [
  ['the root itself', 'posix', '/home/v/.agent-config', '/home/v/.agent-config', true],
  ['a file below', 'posix', '/home/v/.agent-config', '/home/v/.agent-config/a/b.md', true],
  ['a trailing slash on the root', 'posix', '/home/v/.agent-config/', '/home/v/.agent-config/a', true],
  ['a dot dot that stays inside', 'posix', '/home/v/.agent-config', '/home/v/.agent-config/a/../b', true],
  ['a dot dot that leaves', 'posix', '/home/v/.agent-config', '/home/v/.agent-config/../.ssh/authorized_keys', false],
  ['a sibling that starts with the root name', 'posix', '/home/v/.agent-config', '/home/v/.agent-config-evil/x', false],
  ['the parent', 'posix', '/home/v/.agent-config', '/home/v', false],
  ['an unrelated absolute path', 'posix', '/home/v/.agent-config', '/etc/passwd', false],
  ['a name that merely starts with two dots', 'posix', '/r', '/r/..hidden/x', true],
  ['a relative candidate', 'posix', '/home/v/.agent-config', 'a/b', false],
  ['a relative root', 'posix', 'home', '/home/x', false],
  ['a Windows file below', 'win32', 'C:\\Users\\v\\.agent-config', 'C:\\Users\\v\\.agent-config\\a\\b.md', true],
  [
    'a Windows path with other letter case',
    'win32',
    'C:\\Users\\v\\.agent-config',
    'c:\\users\\V\\.AGENT-CONFIG\\a',
    true,
  ],
  [
    'a Windows dot dot that leaves',
    'win32',
    'C:\\Users\\v\\.agent-config',
    'C:\\Users\\v\\.agent-config\\..\\.ssh',
    false,
  ],
  ['another drive', 'win32', 'C:\\Users\\v\\.agent-config', 'D:\\Users\\v\\.agent-config\\a', false],
  ['a UNC path', 'win32', 'C:\\Users\\v\\.agent-config', '\\\\server\\share\\a', false],
  [
    'a UNC path that names the root',
    'win32',
    'C:\\Users\\v\\.agent-config',
    '\\\\?\\C:\\Users\\v\\.agent-config\\a',
    false,
  ],
  [
    'a Windows sibling with a common prefix',
    'win32',
    'C:\\Users\\v\\.agent-config',
    'C:\\Users\\v\\.agent-config-evil',
    false,
  ],
  ['a drive-relative candidate', 'win32', 'C:\\Users\\v', 'C:evil', false],
];

describe('M-03 isSameOrInside', () => {
  it.each(insideCases)('%s', (_title, flavor, root, candidate, expected) => {
    expect(isSameOrInside(root, candidate, flavor)).toBe(expected);
  });
});

type JoinCase = [title: string, flavor: PathFlavor, root: string, relative: string, expected: string];

describe('M-03 joinUnderRoot accepts', () => {
  const accepted: JoinCase[] = [
    ['a file', 'posix', '/h/.agent-config', 'knowledge/index.md', '/h/.agent-config/knowledge/index.md'],
    ['a dot segment', 'posix', '/h/.agent-config', './a/./b', '/h/.agent-config/a/b'],
    [
      'a Windows root',
      'win32',
      'C:\\Users\\v\\.agent-config',
      'knowledge/index.md',
      'C:\\Users\\v\\.agent-config\\knowledge\\index.md',
    ],
  ];
  it.each(accepted)('%s', (_title, flavor, root, relative, expected) => {
    expect(joinUnderRoot(root, relative, flavor)).toEqual({ ok: true, value: expected });
  });
});

describe('M-03 joinUnderRoot refuses', () => {
  const refused: [title: string, flavor: PathFlavor, relative: string][] = [
    ['dot dot', 'posix', '..'],
    ['dot dot then a file', 'posix', '../.ssh/authorized_keys'],
    ['dot dot hidden in the middle', 'posix', 'a/b/../../../x'],
    ['an absolute path', 'posix', '/etc/passwd'],
    ['a UNC look-alike', 'posix', '//server/share/x'],
    ['a Windows drive letter', 'win32', 'D:\\evil'],
    ['a Windows drive letter with a slash', 'win32', 'D:/evil'],
    ['a UNC path', 'win32', '\\\\server\\share\\x'],
    ['a backslash dot dot', 'win32', 'a\\..\\..\\x'],
    ['a NUL', 'posix', 'a\0b'],
    ['an empty path', 'posix', ''],
  ];
  it.each(refused)('%s', (_title, flavor, relative) => {
    const root = flavor === 'win32' ? 'C:\\Users\\v\\.agent-config' : '/h/.agent-config';
    const result = joinUnderRoot(root, relative, flavor);
    expect(result.ok).toBe(false);
  });

  it('M-03 refuses a root that is not absolute', () => {
    expect(joinUnderRoot('home/.agent-config', 'a', 'posix')).toMatchObject({
      ok: false,
      error: { kind: 'root-not-absolute' },
    });
  });
});
