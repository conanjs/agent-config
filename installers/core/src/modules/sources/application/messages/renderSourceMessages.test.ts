import { describe, expect, it } from 'vitest';
import {
  renderFetchFailure,
  renderGitComponent,
  renderGitRefused,
  renderGitVersionError,
  renderPathComponent,
  renderSubmodulesWarning,
  renderTagMoved,
  renderUpdated,
} from '#sources/application/messages/renderSourceMessages.ts';
import type { GitAcquired } from '#sources/domain/model/Acquisition.ts';

const commit = (digit: string): string => digit.repeat(40);
const acquired = (extra: Partial<GitAcquired> = {}): GitAcquired => ({
  kind: 'acquired',
  name: 'kb',
  url: 'https://example.invalid/kb.git',
  ref: 'main',
  commit: '0123456789abcdef0123456789abcdef01234567',
  tag: undefined,
  advancedFrom: undefined,
  submodules: false,
  ...extra,
});

describe('the texts of installer-cli.md "Messages" for sources', () => {
  it('MG-14 names the component, address, ref and the first 12 hex of the commit', () => {
    expect(renderGitComponent(acquired())).toBe(
      'component kb: git https://example.invalid/kb.git main at 0123456789ab',
    );
    expect(renderPathComponent({ kind: 'acquired', name: 'notes', path: '/work/notes' })).toBe(
      'component notes: path /work/notes (live)',
    );
  });

  it('MG-15 prints the range only when the commit moved', () => {
    expect(renderUpdated(acquired())).toBeUndefined();
    expect(renderUpdated(acquired({ advancedFrom: commit('a') }))).toBe('updated kb: aaaaaaaaaaaa..0123456789ab');
  });

  it('MG-22 only for a clone with submodules', () => {
    expect(renderSubmodulesWarning(acquired())).toBeUndefined();
    expect(renderSubmodulesWarning(acquired({ submodules: true }))).toBe(
      'warning: component kb has submodules; they are ignored',
    );
  });

  it('MG-32 is two lines, the second indented, and the cause is one line with credentials hidden', () => {
    const lines = renderFetchFailure({
      kind: 'fetch-failed',
      name: 'kb',
      url: 'https://example.invalid/kb.git',
      ref: 'main',
      cause: "fatal: unable to access 'https://u:s3cr3t-fake@example.invalid/kb.git/'\u001b[31m",
    });
    expect(lines[0]).toBe('error: component kb: cannot fetch git source https://example.invalid/kb.git (ref main)');
    expect(lines[1]).toMatch(/^ {3}cause: fatal: unable to access /);
    expect(lines.join('\n')).not.toContain('s3cr3t');
    expect(lines.join('\n')).not.toContain('\u001b');
    expect(lines).toHaveLength(2);
  });

  it('MG-29 names the tag and both full commits', () => {
    expect(
      renderTagMoved({ kind: 'tag-moved', name: 'kb', tag: 'v1.0.0', locked: commit('1'), current: commit('2') }),
    ).toBe(`error: tag moved: component kb, tag v1.0.0, locked ${commit('1')}, now ${commit('2')}`);
  });

  it('MG-44 for a git older than the minimum', () => {
    expect(renderGitVersionError('kb', '2.40.0')).toBe('error: component kb needs git >=2.50.1, found 2.40.0');
  });

  it('MG-46 for a refused source repeats no address', () => {
    expect(
      renderGitRefused({
        kind: 'refused',
        name: 'evil',
        reason: 'a source address or ref cannot start with a dash (M-05)',
      }),
    ).toBe('error: component evil: git source refused: a source address or ref cannot start with a dash (M-05)');
  });
});
