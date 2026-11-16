// FR-013, AC-2.1 to AC-2.5, M-03: which folder is the home, and which are never a home.
import { describe, expect, it } from 'vitest';
import { checkHomeFolder, chooseAgentHome } from '#variables/domain/home/AgentHome.ts';

describe('M-03 folders that are refused as the agent home', () => {
  it.each([
    ['posix', '/', '/home/v', 'root'],
    ['posix', '//', '/home/v', 'root'],
    ['posix', '/..', '/home/v', 'root'],
    ['posix', '/home/v', '/home/v', 'home'],
    ['posix', '/home/v/', '/home/v', 'home'],
    ['posix', '/home/v/.', '/home/v', 'home'],
    ['posix', '/home/v/x/..', '/home/v', 'home'],
    ['posix', '/home', '/home/v', 'holds the home'],
    ['posix', '/HOME/V', '/home/v', 'case'],
    ['posix', '~', '/home/v', 'not absolute'],
    ['posix', '~/ac', '/home/v', 'not absolute'],
    ['posix', 'ac', '/home/v', 'not absolute'],
    ['posix', '', '/home/v', 'empty'],
    ['posix', ' ', '/home/v', 'blank'],
    ['posix', '/data/ac\n/etc', '/home/v', 'line break'],
    ['posix', '/data/ac\0', '/home/v', 'NUL'],
    ['posix', '/data/ac\u202e', '/home/v', 'bidi'],
    ['posix', '/data/a\u00a0c', '/home/v', 'no-break space'],
    ['posix', '/data/a\u3000c', '/home/v', 'ideographic space'],
    ['win32', 'C:\\', 'C:\\Users\\v', 'drive root'],
    ['win32', 'C:/', 'C:\\Users\\v', 'drive root with a slash'],
    ['win32', 'D:\\', 'C:\\Users\\v', 'other drive root'],
    ['win32', '\\\\server\\share\\', 'C:\\Users\\v', 'share root'],
    ['win32', 'C:\\Users\\v', 'C:\\Users\\v', 'home'],
    ['win32', 'c:\\users\\V\\', 'C:\\Users\\v', 'home with another case'],
    ['win32', 'C:\\Users', 'C:\\Users\\v', 'holds the home'],
    ['win32', '\\data', 'C:\\Users\\v', 'no drive'],
    ['win32', 'C:data', 'C:\\Users\\v', 'drive-relative'],
  ] as const)('%s %j (user home %j): %s', (...[flavor, candidate, userHome]) => {
    expect(checkHomeFolder(candidate, userHome, flavor).ok).toBe(false);
  });

  it.each([
    ['posix', '/data/ac', '/home/v', '/data/ac'],
    ['posix', '/data/ac/', '/home/v', '/data/ac'],
    ['posix', '/home/v/.agent-config', '/home/v', '/home/v/.agent-config'],
    ['posix', '/home/v/a/../.ac', '/home/v', '/home/v/.ac'],
    ['posix', '/home/vv', '/home/v', '/home/vv'],
    ['posix', '/data/my ac', '/home/v', '/data/my ac'],
    ['win32', 'D:\\ac', 'C:\\Users\\v', 'D:\\ac'],
    ['win32', 'C:\\Users\\v\\.agent-config\\', 'C:\\Users\\v', 'C:\\Users\\v\\.agent-config'],
  ] as const)('accepts %s %j', (flavor, candidate, userHome, normalized) => {
    expect(checkHomeFolder(candidate, userHome, flavor)).toEqual({ ok: true, value: normalized });
  });
});

describe('AC-2.1 to AC-2.5 choosing the home', () => {
  const base = { flavor: 'posix', userHome: '/home/v', configuredHome: undefined, recordedHome: undefined } as const;

  it('AC-2.1 the default is .agent-config in the user home, not confirmed', () => {
    expect(chooseAgentHome(base)).toEqual({
      ok: true,
      value: { path: '/home/v/.agent-config', source: 'default', confirmed: false, recordedHome: undefined },
    });
  });

  it('AC-2.2 on Windows the default is below USERPROFILE', () => {
    const result = chooseAgentHome({ ...base, flavor: 'win32', userHome: 'C:\\Users\\v' });
    expect(result.ok && result.value.path).toBe('C:\\Users\\v\\.agent-config');
  });

  it('AC-2.3 AGENT_CONFIG_HOME is the home and is named as the source', () => {
    expect(chooseAgentHome({ ...base, configuredHome: '/data/ac' })).toMatchObject({
      ok: true,
      value: { path: '/data/ac', source: 'AGENT_CONFIG_HOME', confirmed: false },
    });
  });

  it('an empty AGENT_CONFIG_HOME means unset', () => {
    expect(chooseAgentHome({ ...base, configuredHome: '' })).toMatchObject({ ok: true, value: { source: 'default' } });
  });

  it('AC-2.4 a recorded home is confirmed', () => {
    expect(chooseAgentHome({ ...base, recordedHome: '/home/v/.agent-config' })).toMatchObject({
      ok: true,
      value: { source: 'recorded', confirmed: true },
    });
  });

  it('the same folder in AGENT_CONFIG_HOME is still the recorded home', () => {
    expect(chooseAgentHome({ ...base, recordedHome: '/data/ac', configuredHome: '/data/ac/' })).toMatchObject({
      ok: true,
      value: { path: '/data/ac', source: 'recorded', confirmed: true },
    });
  });

  it('AC-2.5 a different AGENT_CONFIG_HOME is a move that names both and is not confirmed', () => {
    expect(chooseAgentHome({ ...base, recordedHome: '/home/v/.agent-config', configuredHome: '/data/new' })).toEqual({
      ok: true,
      value: {
        path: '/data/new',
        source: 'AGENT_CONFIG_HOME',
        confirmed: false,
        recordedHome: '/home/v/.agent-config',
      },
    });
  });

  it.each([
    ['AGENT_CONFIG_HOME of /', { configuredHome: '/' }, 'AGENT_CONFIG_HOME'],
    ['AGENT_CONFIG_HOME of the user home', { configuredHome: '/home/v' }, 'AGENT_CONFIG_HOME'],
    ['a relative AGENT_CONFIG_HOME', { configuredHome: 'ac' }, 'AGENT_CONFIG_HOME'],
    ['a recorded home of /', { recordedHome: '/' }, 'recorded-home'],
    ['a recorded home of the user home', { recordedHome: '/home/v' }, 'recorded-home'],
    [
      'a bad recorded home even when the variable is fine',
      { recordedHome: '/', configuredHome: '/data/ac' },
      'recorded-home',
    ],
    ['a relative user home', { userHome: 'home/v' }, 'user-home'],
  ] as const)('refuses %s', (_title, change, input) => {
    const result = chooseAgentHome({ ...base, ...change });
    expect(result.ok === false && result.error.input).toBe(input);
  });

  it('a refusal never repeats the refused text', () => {
    const result = chooseAgentHome({ ...base, configuredHome: 'S3CRET-relative' });
    expect(JSON.stringify(result)).not.toContain('S3CRET');
  });
});
