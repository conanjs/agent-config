import { describe, expect, it } from 'vitest';
import { checkGitVersion } from '#sources/domain/rules/gitVersion.ts';
import { addressHoldsCredentials, checkGitSourceText } from '#sources/domain/rules/sourceText.ts';

describe('M-05 checkGitSourceText', () => {
  it.each([
    ['an https address and a branch', 'https://example.invalid/x.git', 'main'],
    ['an ssh address with the git user', 'ssh://git@example.invalid/x.git', 'v1.0.0'],
    ['a commit id as the ref', 'https://example.invalid/x.git', '0123456789abcdef0123456789abcdef01234567'],
    ['a ref with a slash', 'https://example.invalid/x.git', 'release/1.2'],
  ])('accepts %s', (_title, url, ref) => {
    expect(checkGitSourceText(url, ref).ok).toBe(true);
  });

  it.each([
    ['an address that starts with a dash', '-oProxyCommand=touch-marker', 'main'],
    ['an address that starts with a dash and holds a space', '-o ProxyCommand=x', 'main'],
    ['a ref that starts with a dash', 'https://example.invalid/x.git', '-x'],
    ['a ref that is an option with a value', 'https://example.invalid/x.git', '--upload-pack=touch x'],
    ['an empty address', '', 'main'],
    ['an empty ref', 'https://example.invalid/x.git', ''],
    ['a space in the address', 'ext::sh -c touch% marker', 'main'],
    ['a tab in the ref', 'https://example.invalid/x.git', 'ma\tin'],
    ['a line break in the address', 'https://example.invalid/x.git\n-oProxyCommand=x', 'main'],
    ['a NUL in the ref', 'https://example.invalid/x.git', 'main\0'],
    ['a DEL in the address', 'https://example.invalid/\u007fx.git', 'main'],
  ])('refuses %s without repeating it', (_title, url, ref) => {
    const result = checkGitSourceText(url, ref);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).not.toContain(ref === '' ? '\u0001' : ref);
  });
});

describe('M-07 addressHoldsCredentials', () => {
  it.each([
    ['https://example.invalid/x.git', false],
    ['ssh://git@example.invalid/x.git', false],
    ['https://vinh:s3cr3t@example.invalid/x.git', true],
    ['https://vinh@example.invalid/x.git', true],
    ['ssh://git:s3cr3t@example.invalid/x.git', true],
    ['not a url', false],
  ])('%s is %s', (url, expected) => {
    expect(addressHoldsCredentials(url)).toBe(expected);
  });
});

describe('M-05 checkGitVersion (git 2.50.1 or later)', () => {
  it.each([
    ['git version 2.50.1', true],
    ['git version 2.50.1\n', true],
    ['git version 2.51.0', true],
    ['git version 2.50.1.windows.1', true],
    ['git version 3.0.0', true],
    ['git version 2.49.9', false],
    ['git version 2.50.0', false],
    ['git version 1.99.99', false],
    ['git version 2.9.9', false],
  ])('%j is met: %s', (output, ok) => {
    expect(checkGitVersion(output).ok).toBe(ok);
  });

  it.each([
    ['git version 2.40.0', '2.40.0'],
    ['', 'not found'],
    ['command not found', 'not found'],
    [undefined, 'not found'],
  ])('reports %j as found %s', (output, found) => {
    expect(checkGitVersion(output)).toEqual({ ok: false, found });
  });
});
