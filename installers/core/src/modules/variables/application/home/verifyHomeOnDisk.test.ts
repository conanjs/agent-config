// M-03: a home that is a link to somewhere forbidden is refused by its real path.
import { describe, expect, it } from 'vitest';
import type { IdentityAnswer, PathProbe, RealPathAnswer } from '#shared/application/containment/PathProbe.ts';
import { verifyHomeOnDisk } from '#variables/application/home/verifyHomeOnDisk.ts';
import type { AgentHomeChoice } from '#variables/domain/home/AgentHome.ts';

const choice = (source: AgentHomeChoice['source']): AgentHomeChoice => ({
  path: '/home/v/.agent-config',
  source,
  confirmed: false,
  recordedHome: undefined,
});
// Folders by identity: / is 1, /home is 2, /home/v is 3; a firmlink-style path reaches 3 as well.
const identities: Record<string, IdentityAnswer> = {
  '/': { kind: 'identity', dev: 1n, ino: 1n },
  '/home': { kind: 'identity', dev: 1n, ino: 2n },
  '/home/v': { kind: 'identity', dev: 1n, ino: 3n },
  '/firm/home/v': { kind: 'identity', dev: 1n, ino: 3n },
  '/home/v/.agent-config': { kind: 'missing' },
  '/data/v': { kind: 'identity', dev: 1n, ino: 7n },
};
const probeOf = (answers: Record<string, RealPathAnswer>, extra: Record<string, IdentityAnswer> = {}): PathProbe => ({
  realPath: (path) => answers[path] ?? { kind: 'real', path },
  isLink: () => 'not-link',
  identity: (path) => ({ ...identities, ...extra })[path] ?? { kind: 'missing' },
});

describe('M-03 the real path of the home', () => {
  it('accepts a home that is not there yet', () => {
    expect(
      verifyHomeOnDisk(choice('default'), '/home/v', 'posix', probeOf({ '/home/v/.agent-config': { kind: 'missing' } }))
        .ok,
    ).toBe(true);
  });

  it('accepts a home that is its own real path', () => {
    expect(verifyHomeOnDisk(choice('default'), '/home/v', 'posix', probeOf({})).ok).toBe(true);
  });

  it.each([
    ['a link to the root', { kind: 'real', path: '/' }, 'default', 'default-home'],
    ['a link to the user home', { kind: 'real', path: '/home/v' }, 'AGENT_CONFIG_HOME', 'AGENT_CONFIG_HOME'],
    ['a link to the parent of the user home', { kind: 'real', path: '/home' }, 'recorded', 'recorded-home'],
    ['a path that cannot be checked', { kind: 'unknown' }, 'default', 'default-home'],
  ] as const)('refuses %s', (_title, answer, source, input) => {
    const result = verifyHomeOnDisk(choice(source), '/home/v', 'posix', probeOf({ '/home/v/.agent-config': answer }));
    expect(result.ok === false && result.error.input).toBe(input);
  });

  it('M-03 refuses a firmlink-style second path to the user home, which no text rule sees', () => {
    const result = verifyHomeOnDisk(
      { ...choice('AGENT_CONFIG_HOME'), path: '/firm/home/v' },
      '/home/v',
      'posix',
      probeOf({}),
    );
    expect(result.ok === false && result.error.input).toBe('AGENT_CONFIG_HOME');
  });

  it('M-03 refuses a home whose identity cannot be read', () => {
    const result = verifyHomeOnDisk(
      choice('default'),
      '/home/v',
      'posix',
      probeOf({}, { '/home/v/.agent-config': { kind: 'unknown' } }),
    );
    expect(result.ok).toBe(false);
  });

  it('compares with the real path of a user home that is itself a link', () => {
    const probe = probeOf({
      '/home/v': { kind: 'real', path: '/data/v' },
      '/home/v/.agent-config': { kind: 'real', path: '/data/v' },
    });
    expect(verifyHomeOnDisk(choice('default'), '/home/v', 'posix', probe).ok).toBe(false);
  });
});
