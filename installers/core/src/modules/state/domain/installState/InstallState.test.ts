// install-state/v1: every field is checked, a path has one entry, a newer major is refused (DR-205), and the same state is the same bytes.
import { describe, expect, it } from 'vitest';
import { emitInstallState, parseInstallState, type InstallState } from '#state/domain/installState/InstallState.ts';

const hash = 'a'.repeat(64);
const state: InstallState = {
  installer: { version: '0.2.0', commit: '825ea82' },
  home: '/h/.agent-config',
  approved_privileged_hash: hash,
  last_run: { time: '2026-11-20T09:14:03.000Z', command: 'install', exit: 0 },
  components: { kb: '9c1d5e7a2b4f60813d9ce5a7b1f20486c3d7e951', notes: 'live' },
  entries: [
    {
      path: '/h/.agent-config/core',
      class: 'linked',
      kind: 'symlink',
      target: '/h/.agent-config/store/core@0123456789ab',
      component: 'core',
      privileged: false,
    },
    {
      path: '/h/.agent-config/generated/index.md',
      class: 'generated',
      kind: 'file',
      hash,
      component: 'core',
      privileged: false,
    },
    {
      path: '/h/.copilot/knowledge',
      class: 'compat',
      kind: 'symlink',
      target: '/h/.agent-config/knowledge',
      component: 'core',
      privileged: false,
      retires: 'v1.0.0',
    },
  ],
};

describe('the text of install-state.json', () => {
  it('reads back what it wrote', () => {
    expect(parseInstallState(emitInstallState(state))).toEqual({ ok: true, value: state });
  });

  it('sorts entries by path, so the same run is the same bytes', () => {
    const shuffled: InstallState = { ...state, entries: [...state.entries].reverse() };
    expect(emitInstallState(shuffled)).toBe(emitInstallState(state));
  });

  it('works without an approved hash', () => {
    const without: InstallState = { ...state };
    delete (without as { approved_privileged_hash?: string }).approved_privileged_hash;
    expect(parseInstallState(emitInstallState(without)).ok).toBe(true);
  });
});

describe('a state file that is refused', () => {
  const valid = JSON.parse(emitInstallState(state)) as Record<string, unknown>;
  const withChange = (change: (copy: Record<string, unknown>) => void): string => {
    const copy = structuredClone(valid);
    change(copy);
    return JSON.stringify(copy);
  };
  const entry = (copy: Record<string, unknown>, index = 0): Record<string, unknown> =>
    (copy['entries'] as Record<string, unknown>[])[index] as Record<string, unknown>;

  it.each([
    ['empty', ''],
    ['truncated', emitInstallState(state).slice(0, 80)],
    ['an array', '[]'],
    ['no schema', withChange((c) => delete c['schema'])],
    ['no home', withChange((c) => delete c['home'])],
    ['no last_run', withChange((c) => delete c['last_run'])],
    ['a fractional exit code', withChange((c) => ((c['last_run'] as Record<string, unknown>)['exit'] = 0.5))],
    ['a short privileged hash', withChange((c) => (c['approved_privileged_hash'] = 'abc'))],
    ['components with a number', withChange((c) => ((c['components'] as Record<string, unknown>)['kb'] = 7))],
    ['entries that are not a list', withChange((c) => (c['entries'] = {}))],
    ['an entry with an unknown class', withChange((c) => (entry(c)['class'] = 'weird'))],
    ['an entry with an unknown kind', withChange((c) => (entry(c)['kind'] = 'socket'))],
    ['an entry with no component', withChange((c) => delete entry(c)['component'])],
    ['an entry with a text flag', withChange((c) => (entry(c)['privileged'] = 'yes'))],
    ['an entry with a bad hash', withChange((c) => (entry(c, 1)['hash'] = 'Z'.repeat(64)))],
    ['an entry with an empty path', withChange((c) => (entry(c)['path'] = ''))],
    ['an entry with a huge path', withChange((c) => (entry(c)['path'] = 'p'.repeat(5000)))],
    ['two entries for one path', withChange((c) => (entry(c, 1)['path'] = entry(c, 0)['path']))],
  ])('refuses %s as corrupt', (_title, text) => {
    const result = parseInstallState(text);
    expect(result.ok === false && result.error.kind).toBe('corrupt');
  });

  it('refuses a newer major without reading further', () => {
    const result = parseInstallState(withChange((c) => (c['schema'] = 'install-state/v2')));
    expect(result.ok === false && result.error.kind).toBe('newer-major');
  });
});
