// Tests of the entry point (specs/022 T077): the dispatch, the usage errors and the help text.
import { describe, expect, it } from 'vitest';
import { HELP, runBuild } from './build.ts';
import type { ToolEnv } from './tool-io.ts';

const env: ToolEnv = {
  cwd: '/nowhere',
  home: '/h',
  platform: 'linux',
  today: '2026-11-14',
  nodeVersion: '24.12.0',
  gitHead: () => ({ ok: false, message: 'no git' }),
  gitTracked: () => [],
};

describe('build.ts dispatch (A-8: exit 0, 1, 2)', () => {
  it.each(['--help', '-h', 'help'])('%s prints the help and exits 0', (flag) => {
    expect(runBuild([flag], env)).toEqual({ code: 0, out: `${HELP}\n`, err: '' });
  });

  it('exits 2 with the help for no subcommand and with a message for an unknown one', () => {
    expect(runBuild([], env)).toMatchObject({
      code: 2,
      out: '',
      err: expect.stringContaining('Subcommands built in this version') as string,
    });
    expect(runBuild(['cite'], env)).toMatchObject({
      code: 2,
      err: expect.stringContaining('"cite" is not a subcommand built in this version') as string,
    });
  });

  it('does not run a name that only exists on Object.prototype', () => {
    expect(runBuild(['constructor'], env).code).toBe(2);
  });

  it('hands each built subcommand its own arguments', () => {
    expect(runBuild(['check-schemas'], env).code).toBe(2);
    expect(runBuild(['layout', '--nope'], env).code).toBe(2);
    expect(runBuild(['budget'], env).code).toBe(2);
  });

  it('says in the help what is not built yet, so the text does not promise more than the tool does', () => {
    expect(HELP).toContain(
      'Not built yet (later phases): build (skill and agent sources), budget without --baseline, cite.',
    );
  });
});
