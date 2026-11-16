// M-03 names and path fields (plan.md, decisions/security.md). The rules live in contracts/lib; these tests prove the installer's
// view of them: what is accepted, what is refused, and that no refusal repeats the refused text.
import { describe, expect, it } from 'vitest';
import { parseComponentName, parseRelativePath } from '#shared/domain/name/NameRules.ts';

const secretLooking = 'tok-S3CRET-value';

describe('M-03 component names', () => {
  it.each(['kb', 'agentic-sdlc', 'a', '0abc', 'a-b-1', 'a'.repeat(64)])('accepts %j', (name) => {
    expect(parseComponentName(name)).toEqual({ ok: true, value: name });
  });

  it.each([
    ['empty', ''],
    ['upper case', 'Kb'],
    ['leading hyphen', '-kb'],
    ['underscore', 'a_b'],
    ['dot', 'a.b'],
    ['space', 'a b'],
    ['dot dot', '..'],
    ['slash', 'a/b'],
    ['backslash', 'a\\b'],
    ['NUL', 'kb\0'],
    ['65 characters', 'a'.repeat(65)],
    ['non-ASCII letter', 'k\u00e9'],
    ['newline', 'kb\nx'],
    ['a drive letter', 'c:'],
    ['con', 'con'],
    ['prn', 'prn'],
    ['aux', 'aux'],
    ['nul', 'nul'],
    ['com1', 'com1'],
    ['lpt9', 'lpt9'],
  ])('refuses %s', (_title, name) => {
    const result = parseComponentName(name);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('invalid-name');
  });

  it('M-03 never repeats a refused name, which may hold a secret', () => {
    const result = parseComponentName(secretLooking.toUpperCase());
    expect(JSON.stringify(result)).not.toContain(secretLooking.toUpperCase());
  });
});

describe('M-03 relative path fields', () => {
  it.each(['a', 'a/b.md', './a', 'a/./b', 'knowledge/index.md', 'a b/c'])('accepts %j', (value) => {
    expect(parseRelativePath(value)).toEqual({ ok: true, value });
  });

  it.each([
    ['empty', ''],
    ['dot dot', '..'],
    ['leading dot dot', '../x'],
    ['dot dot in the middle', 'a/../../x'],
    ['trailing dot dot', 'a/..'],
    ['absolute', '/etc/passwd'],
    ['double slash (UNC look-alike)', '//server/share'],
    ['drive letter with slash', 'C:/Windows'],
    ['drive letter with backslash', 'C:\\Windows'],
    ['drive-relative', 'C:foo'],
    ['UNC with backslashes', '\\\\server\\share\\x'],
    ['backslash', 'a\\b'],
    ['backslash dot dot', 'a\\..\\..\\b'],
    ['NUL', 'a\0b'],
    ['colon (data stream)', 'a:b'],
    ['segment ending in a dot', 'a/b.'],
    ['segment ending in a space', 'a/b /c'],
    ['three dots segment', 'a/.../b'],
    ['a Windows device name', 'con'],
    ['a device name with an extension', 'docs/NUL.txt'],
    ['a device name in lower case in a folder', 'a/aux/b'],
    ['a device name with spaces before the dot', 'a/prn .md'],
    ['conin$', 'conin$'],
    ['com with a superscript digit', 'a/com\u00b9.txt'],
    ['lpt with a digit', 'LPT3'],
  ])('refuses %s', (_title, value) => {
    const result = parseRelativePath(value);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('invalid-path');
  });

  it('M-03 never repeats a refused path', () => {
    const result = parseRelativePath(`../${secretLooking}`);
    expect(JSON.stringify(result)).not.toContain(secretLooking);
  });
});
