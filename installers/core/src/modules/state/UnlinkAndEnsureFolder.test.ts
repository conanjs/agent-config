// AC-8.3, M-14, M-03: removing a link the installer placed (alone and as a journaled operation), and making Copilot's home.
import { describe, expect, it } from 'vitest';
import { composeState } from '#state/StateModule.ts';
import { createMemoryState } from '#state/infrastructure/memory/MemoryState.ts';

const target = '/h/.agent-config/patterns';
const link = '/h/.copilot/patterns';

describe('AC-8.3 removing one link', () => {
  function withLink() {
    const machine = createMemoryState();
    machine.disk.seedFolder(target);
    machine.disk.seedFile(`${target}/index.md`, 'index');
    machine.disk.seedLink(link, target);
    return machine;
  }

  it('removes a link that still points at the recorded target, and leaves the target alone', () => {
    const machine = withLink();
    expect(composeState(machine.ports).removeLink({ path: link, target })).toEqual({ ok: true, value: 'removed' });
    expect(machine.disk.listing().some((line) => line.startsWith(`${link} `))).toBe(false);
    expect(machine.disk.listing()).toContain(`${target}/index.md file 644 "index"`);
  });

  it('says absent when nothing is there', () => {
    expect(composeState(createMemoryState().ports).removeLink({ path: link, target })).toEqual({
      ok: true,
      value: 'absent',
    });
  });

  it.each([
    [
      'a link to another target',
      (machine: ReturnType<typeof createMemoryState>) => machine.disk.seedLink(link, '/elsewhere'),
    ],
    ['a real file', (machine: ReturnType<typeof createMemoryState>) => machine.disk.seedFile(link, 'mine')],
    [
      'a real folder',
      (machine: ReturnType<typeof createMemoryState>) => machine.disk.seedFile(`${link}/mine.md`, 'mine'),
    ],
  ])('leaves %s', (_title, seed) => {
    const machine = createMemoryState();
    seed(machine);
    const before = machine.disk.listing();
    expect(composeState(machine.ports).removeLink({ path: link, target })).toMatchObject({
      ok: false,
      error: { kind: 'not-own' },
    });
    expect(machine.disk.listing()).toEqual(before);
  });

  it('M-03 refuses a path outside the home and the agent folders', () => {
    const machine = createMemoryState();
    machine.disk.seedLink('/etc/evil', target);
    expect(composeState(machine.ports).removeLink({ path: '/etc/evil', target })).toMatchObject({
      ok: false,
      error: { kind: 'outside' },
    });
    expect(machine.disk.listing()).toContain(`/etc/evil link 777 ${target}`);
  });

  it('M-04 refuses a path below a link that leaves its root', () => {
    const machine = createMemoryState();
    machine.disk.seedFolder('/outside');
    machine.disk.seedLink('/outside/patterns', target);
    machine.disk.seedLink('/h/.copilot/jump', '/outside');
    expect(composeState(machine.ports).removeLink({ path: '/h/.copilot/jump/patterns', target })).toMatchObject({
      ok: false,
      error: { kind: 'outside' },
    });
    expect(machine.disk.listing()).toContain(`/outside/patterns link 777 ${target}`);
  });
});

describe('AC-8.3 a journaled unlink', () => {
  const journal = (kind: 'symlink' = 'symlink') => ({
    home: '/h/.agent-config',
    command: 'install',
    started: '2026-11-20T09:14:03.000Z',
    operations: [{ op: 'unlink' as const, path: link, old: { state: 'link' as const, target, kind } }],
  });

  it('is carried out by switchLinks and put back by a restore', () => {
    const machine = createMemoryState();
    machine.disk.seedFolder(target);
    machine.disk.seedLink(link, target);
    const state = composeState(machine.ports);
    expect(state.writeJournal(journal()).ok).toBe(true);
    expect(state.switchLinks(journal()).ok).toBe(true);
    expect(machine.ports.fs.exists(link as never)).toBe(false);
    expect(state.restoreFromJournal().ok).toBe(true);
    expect(machine.ports.links.readLink(link as never)).toBe(target);
  });

  it('is refused by switchLinks when the link now points elsewhere, and nothing is removed', () => {
    const machine = createMemoryState();
    machine.disk.seedLink(link, '/elsewhere');
    const result = composeState(machine.ports).switchLinks(journal());
    expect(result).toMatchObject({ ok: false, error: { path: link, refusal: { kind: 'not-own' } } });
    expect(machine.disk.listing()).toContain(`${link} link 777 /elsewhere`);
  });

  it('is not undone after the commit when the state no longer lists the link', () => {
    const machine = createMemoryState();
    machine.disk.seedFolder(target);
    const state = composeState(machine.ports);
    state.writeJournal(journal());
    state.commit(
      { components: {} },
      {
        installer: { version: '0.2.0', commit: 'abc' },
        home: '/h/.agent-config',
        last_run: { time: 'now', command: 'install', exit: 0 },
        components: {},
        entries: [],
      },
    );
    machine.disk.seedFile(
      '/h/.agent-config/install-state.pending.json',
      JSON.stringify({ ...journal(), schema: 'install-journal/v1' }),
    );
    expect(state.restoreFromJournal()).toEqual({ ok: true, value: { interrupted: false, discarded: true } });
    expect(machine.ports.fs.exists(link as never)).toBe(false);
  });
});

describe('AC-8.2 making Copilot home', () => {
  it('makes a missing agent folder owner-only', () => {
    const machine = createMemoryState();
    machine.disk.seedFolder('/h');
    machine.ports.fs.remove('/h/.copilot' as never);
    expect(composeState(machine.ports).ensureFolder('/h/.copilot')).toEqual({ ok: true, value: 'created' });
    expect(machine.disk.listing()).toContain('/h/.copilot folder 700');
  });

  it('says existed for one that is there, and makes a level inside the home', () => {
    const machine = createMemoryState();
    const state = composeState(machine.ports);
    expect(state.ensureFolder('/h/.copilot')).toEqual({ ok: true, value: 'existed' });
    expect(state.ensureFolder('/h/.agent-config/store/x')).toEqual({ ok: true, value: 'created' });
  });

  it('M-03 refuses a folder outside the home, the backups folder and the agent folders', () => {
    const machine = createMemoryState();
    const state = composeState(machine.ports);
    for (const folder of ['/etc/x', '/h', '/h/.ssh', '/h/.copilotx', '/h/.copilot/../.ssh']) {
      expect(state.ensureFolder(folder).ok).toBe(false);
    }
    expect(machine.disk.listing().some((line) => line.startsWith('/etc') || line.startsWith('/h/.ssh'))).toBe(false);
  });
});
