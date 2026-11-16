// Unit tests of the check of the local files (specs/022 T150, AC-3.8). The scenarios of tests/installer-sources/sources.feature
// drive the script on real git repositories; these pin the pure rules: which paths count and how a finding reads.
import { describe, expect, it } from 'vitest';
import { check, isLocalFile } from './check-local-files.ts';

describe('AC-3.8 which paths are local files', () => {
  it.each([
    ['components.local.yaml', true],
    ['variables.local.yaml', true],
    ['sub/dir/variables.local.yaml', false],
    ['contracts/components-list/v1/examples/valid/components.local.yaml', false],
    ['components.yaml', false],
    ['components.local.yaml.bak', false],
    ['my-components.local.yaml', false],
    ['components.local.yaml/readme.md', false],
  ])('%s is %s', (file, expected) => {
    expect(isLocalFile(file)).toBe(expected);
  });
});

describe('AC-3.8 the findings', () => {
  it('passes when no local file is tracked or staged', () => {
    expect(check(['components.yaml', 'a.md'], ['b.md'])).toEqual({
      code: 0,
      lines: ['ok: no local file is tracked or staged'],
    });
  });

  it('names a tracked file', () => {
    expect(check(['components.local.yaml'], [])).toEqual({
      code: 1,
      lines: ['error: components.local.yaml is tracked by git'],
    });
  });

  it('does not report a tracked or staged file of the same name under a subfolder', () => {
    expect(check(['tests/fixtures/components.local.yaml'], ['sub/variables.local.yaml']).code).toBe(0);
  });

  it('names a staged root file', () => {
    expect(check([], ['variables.local.yaml'])).toEqual({
      code: 1,
      lines: ['error: variables.local.yaml is staged for commit'],
    });
  });

  it('reports a file that is tracked and staged once, as tracked, and sorts by path', () => {
    expect(check(['variables.local.yaml'], ['variables.local.yaml', 'components.local.yaml']).lines).toEqual([
      'error: components.local.yaml is staged for commit',
      'error: variables.local.yaml is tracked by git',
    ]);
  });
});
