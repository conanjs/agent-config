import { describe, expect, it } from 'vitest';
import { chooseHome } from '#variables/application/home/chooseHome.ts';

describe('AC-2.3 the home of a run', () => {
  it('uses AGENT_CONFIG_HOME', () => {
    const result = chooseHome({
      flavor: 'posix',
      userHome: '/home/v',
      configuredHome: '/data/ac',
      recordedHome: undefined,
    });
    expect(result.ok && result.value.path).toBe('/data/ac');
  });

  it('M-03 refuses a root', () => {
    const result = chooseHome({ flavor: 'posix', userHome: '/home/v', configuredHome: '/', recordedHome: undefined });
    expect(result.ok).toBe(false);
  });
});
