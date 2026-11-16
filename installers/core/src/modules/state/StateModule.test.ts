// MOD-11: the composer fills the ports in; one install-shaped run through the API proves the wiring on an in-memory machine.
import { describe, expect, it } from 'vitest';
import { composeState } from '#state/StateModule.ts';
import { createMemoryState } from '#state/infrastructure/memory/MemoryState.ts';

describe('the state composer', () => {
  it('runs lock, home, backup, journal, switch, commit, log and release in the order of DR-202', async () => {
    const machine = createMemoryState();
    machine.disk.seedFolder('/h/.agent-config/store/core@0123456789ab');
    const state = composeState(machine.ports);
    expect(state.createHome(machine.userHome)).toEqual({ ok: true, value: 'existed' });
    const lock = await state.acquireLock({ command: 'install', pid: 1, mode: 'wait' });
    if (!lock.ok) throw new Error('the lock was free');
    const journal = {
      home: '/h/.agent-config',
      command: 'install',
      started: '2026-11-20T09:14:03.000Z',
      operations: [
        {
          op: 'link' as const,
          path: '/h/.agent-config/core',
          kind: 'symlink' as const,
          target: '/h/.agent-config/store/core@0123456789ab',
          old: { state: 'absent' as const },
        },
      ],
    };
    expect(state.backup(['/h/.copilot/nothing'])).toEqual({ ok: true, value: { kind: 'none' } });
    expect(state.writeJournal(journal).ok).toBe(true);
    expect(state.switchLinks(journal).ok).toBe(true);
    const committed = state.commit(
      { components: {} },
      {
        installer: { version: '0.2.0', commit: 'abc' },
        home: '/h/.agent-config',
        last_run: { time: journal.started, command: 'install', exit: 0 },
        components: {},
        entries: [
          {
            path: '/h/.agent-config/core',
            class: 'linked',
            kind: 'symlink',
            target: journal.operations[0]!.target,
            component: 'core',
            privileged: false,
          },
        ],
      },
    );
    expect(committed).toEqual({ ok: true, value: 'committed' });
    expect(
      state.appendLog({ time: journal.started, command: 'install', exit: 0, components: [], approved_privileged: [] })
        .ok,
    ).toBe(true);
    expect(state.pruneStore({ core: '0123456789ab' })).toEqual([]);
    expect(state.releaseLock(lock.value)).toBe('removed');
    expect(state.restoreFromJournal()).toEqual({ ok: true, value: { interrupted: false, discarded: false } });
    expect(state.readInstallState().ok && state.readInstallState()).toMatchObject({
      ok: true,
      value: { present: true },
    });
    expect(state.readComponentsLock()).toEqual({ ok: true, value: { present: true, value: { components: {} } } });
    expect(state.readNewestBackup()).toEqual({ ok: true, value: { kind: 'none' } });
    expect(machine.disk.listing().some((line) => line.includes('install.lock'))).toBe(false);
  });

  it('writes a generated file by temporary file and rename and places a link through the same ports', () => {
    const machine = createMemoryState();
    machine.disk.seedFolder('/h/.agent-config/store/x@aaaaaaaaaaaa');
    const state = composeState(machine.ports);
    expect(state.writeFile('/h/.agent-config/generated.md', 'text')).toEqual({ ok: true, value: 'written' });
    expect(
      state.placeLink({ path: '/h/.claude/skills', target: '/h/.agent-config/store/x@aaaaaaaaaaaa', kind: 'symlink' })
        .ok,
    ).toBe(true);
  });
});
