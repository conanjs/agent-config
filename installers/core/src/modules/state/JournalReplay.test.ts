// EDGE-4, DR-202, DR-205: a run killed at any point leaves a journal that puts every path back. Each kill point of the fault adapter
// (before-first-switch, after-switch:k, mid-switch, before-commit) is replayed on an in-memory disk, and the disk after the restore is
// compared with the disk before the run started.
import { describe, expect, it } from 'vitest';
import { sha256Hex } from '#shared/domain/hash/sha256Hex.ts';
import { emitComponentsLock } from '#state/domain/components/ComponentsLock.ts';
import type { StateComponentsLock, StateJournal } from '#state/application/StateTypes.ts';
import { composeState } from '#state/StateModule.ts';
import type { StatePorts } from '#state/application/StatePorts.ts';
import { createMemoryState, type MemoryState } from '#state/infrastructure/memory/MemoryState.ts';

class Killed extends Error {}

type Call = {
  readonly port: 'links' | 'fs';
  readonly method: string;
  readonly args: readonly unknown[];
  readonly phase: 'before' | 'after';
};

// Wraps both ports so a rule can end the "process" (throw) before or after any call; the throw skips every `finally`, as a SIGKILL does.
function killWhen(ports: StatePorts, rule: (call: Call) => boolean): StatePorts {
  const wrap = <T extends object>(port: 'links' | 'fs', target: T): T =>
    new Proxy(target, {
      get(object, key) {
        const member: unknown = Reflect.get(object, key);
        if (typeof member !== 'function') return member;
        return (...args: unknown[]) => {
          if (rule({ port, method: String(key), args, phase: 'before' })) throw new Killed();
          const result: unknown = (member as (...values: unknown[]) => unknown).apply(object, args);
          if (rule({ port, method: String(key), args, phase: 'after' })) throw new Killed();
          return result;
        };
      },
    });
  return { ...ports, links: wrap('links', ports.links), fs: wrap('fs', ports.fs) };
}

const MUTATIONS = new Set(['createLink', 'switchLink', 'removeLink']);

function scene(flavor: 'posix' | 'win32' = 'posix') {
  const machine = createMemoryState(flavor);
  const sep = flavor === 'posix' ? '/' : '\\';
  const at = (...parts: string[]): string => [machine.userHome, ...parts].join(sep);
  const paths = {
    core: at('.agent-config', 'core'),
    patterns: at('.copilot', 'patterns'),
    skills: at('.claude', 'skills'),
    index: at('.agent-config', 'generated', 'index.md'),
    lock: at('.agent-config', 'components.lock'),
    storeCore: at('.agent-config', 'store', 'core@0123456789ab'),
    homePatterns: at('.agent-config', 'patterns'),
    newSkills: at('.agent-config', 'skills-new'),
    oldSkills: at('.agent-config', 'skills-old'),
  };
  const { disk } = machine;
  for (const folder of [
    paths.storeCore,
    paths.homePatterns,
    paths.newSkills,
    paths.oldSkills,
    at('.agent-config', 'generated'),
  ]) {
    disk.seedFolder(folder);
  }
  disk.seedFile(`${paths.patterns}${sep}mine.md`, 'mine');
  disk.seedLink(paths.skills, paths.oldSkills);
  return { machine, paths, sep };
}

const INDEX_TEXT = 'generated index\n';
const LOCK: StateComponentsLock = { components: {} };

// What `install` does between the lock and the commit, with the state module's calls in the order of DR-202.
function runInstall(
  machine: MemoryState,
  ports: StatePorts,
  paths: ReturnType<typeof scene>['paths'],
  sep: string,
): void {
  const state = composeState(ports);
  const made = state.backup([paths.patterns]);
  if (!made.ok || made.value.kind !== 'made') throw new Error('the scene must make a backup');
  const backup = `${made.value.folder}${sep}${made.value.items[0]?.backup ?? ''}`;
  const journal: StateJournal = {
    home: ports.home,
    command: 'install',
    started: '2026-11-20T09:14:03.000Z',
    operations: [
      { op: 'link', path: paths.core, kind: 'symlink', target: paths.storeCore, old: { state: 'absent' } },
      {
        op: 'link',
        path: paths.patterns,
        kind: 'symlink',
        target: paths.homePatterns,
        old: { state: 'backed-up', backup },
      },
      {
        op: 'link',
        path: paths.skills,
        kind: 'symlink',
        target: paths.newSkills,
        old: { state: 'link', target: paths.oldSkills, kind: 'symlink' },
      },
      { op: 'write', path: paths.index, hash: sha256Hex(INDEX_TEXT), old: { state: 'absent' } },
      { op: 'write', path: paths.lock, hash: sha256Hex(emitComponentsLock(LOCK)), old: { state: 'absent' } },
    ],
  };
  state.writeJournal(journal);
  state.writeFile(paths.index, INDEX_TEXT);
  state.switchLinks(journal);
  state.commit(LOCK, {
    installer: { version: '0.2.0', commit: '825ea82' },
    home: ports.home,
    last_run: { time: journal.started, command: 'install', exit: 0 },
    components: {},
    entries: [
      {
        path: paths.core,
        class: 'linked',
        kind: 'symlink',
        target: paths.storeCore,
        component: 'core',
        privileged: false,
      },
      {
        path: paths.patterns,
        class: 'compat',
        kind: 'symlink',
        target: paths.homePatterns,
        component: 'core',
        privileged: false,
      },
      {
        path: paths.skills,
        class: 'linked',
        kind: 'symlink',
        target: paths.newSkills,
        component: 'core',
        privileged: false,
      },
      {
        path: paths.index,
        class: 'generated',
        kind: 'file',
        hash: sha256Hex(INDEX_TEXT),
        component: 'core',
        privileged: false,
      },
      {
        path: paths.lock,
        class: 'generated',
        kind: 'file',
        hash: sha256Hex(emitComponentsLock(LOCK)),
        component: 'core',
        privileged: false,
      },
    ],
  });
  void machine;
}

// The disk without what a restore never deletes: the backups folder and a temporary file a kill left.
function visible(machine: MemoryState): string[] {
  return machine.disk.listing().filter((line) => !line.includes('.agent-config-backups') && !line.includes('.tmp'));
}

describe('EDGE-4 every kill point of the fault adapter is restorable', () => {
  const killPoints: [string, (call: Call) => boolean][] = [
    ['before-first-switch', (call) => call.port === 'links' && MUTATIONS.has(call.method) && call.phase === 'before'],
    [
      'after-switch:1',
      (() => {
        let done = 0;
        return (call: Call) =>
          call.port === 'links' && MUTATIONS.has(call.method) && call.phase === 'after' && ++done === 1;
      })(),
    ],
    [
      'after-switch:2',
      (() => {
        let done = 0;
        return (call: Call) =>
          call.port === 'links' && MUTATIONS.has(call.method) && call.phase === 'after' && ++done === 2;
      })(),
    ],
    [
      'after-switch:3 (the last switch; the write is still to come)',
      (() => {
        let done = 0;
        return (call: Call) =>
          call.port === 'links' && MUTATIONS.has(call.method) && call.phase === 'after' && ++done === 3;
      })(),
    ],
    [
      'between the removal of a real folder and its link',
      (call) =>
        call.port === 'fs' &&
        call.method === 'remove' &&
        call.phase === 'after' &&
        String(call.args[0]).endsWith('patterns'),
    ],
    [
      'before-commit (all links switched, the state file not yet renamed)',
      (call) =>
        call.port === 'fs' &&
        call.method === 'rename' &&
        call.phase === 'before' &&
        String(call.args[1]).endsWith('install-state.json'),
    ],
    [
      'before the journal exists (the rename of its temporary file)',
      (call) =>
        call.port === 'fs' &&
        call.method === 'rename' &&
        call.phase === 'before' &&
        String(call.args[1]).endsWith('install-state.pending.json'),
    ],
  ];

  it.each(killPoints)('killed at %s, the restore gives the disk back as it was', (_title, rule) => {
    const { machine, paths, sep } = scene();
    const before = visible(machine);
    expect(() => runInstall(machine, killWhen(machine.ports, rule), paths, sep)).toThrow(Killed);
    const restored = composeState(machine.ports).restoreFromJournal();
    expect(restored.ok).toBe(true);
    expect(visible(machine)).toEqual(before);
  });

  it('a restore that is run twice (a crash during the restore) gives the same disk', () => {
    const { machine, paths, sep } = scene();
    const before = visible(machine);
    let done = 0;
    const rule = (call: Call): boolean =>
      call.port === 'links' && MUTATIONS.has(call.method) && call.phase === 'after' && ++done === 2;
    expect(() => runInstall(machine, killWhen(machine.ports, rule), paths, sep)).toThrow(Killed);
    let undone = 0;
    const crash = (call: Call): boolean =>
      call.port === 'links' && MUTATIONS.has(call.method) && call.phase === 'after' && ++undone === 1;
    expect(() => composeState(killWhen(machine.ports, crash)).restoreFromJournal()).toThrow(Killed);
    expect(composeState(machine.ports).restoreFromJournal().ok).toBe(true);
    expect(visible(machine)).toEqual(before);
  });

  it('the report names the journal, one record per operation, last operation first', () => {
    const { machine, paths, sep } = scene();
    const rule = (call: Call): boolean =>
      call.port === 'fs' &&
      call.method === 'rename' &&
      call.phase === 'before' &&
      String(call.args[1]).endsWith('install-state.json');
    expect(() => runInstall(machine, killWhen(machine.ports, rule), paths, sep)).toThrow(Killed);
    const result = composeState(machine.ports).restoreFromJournal();
    expect(result.ok && result.value.interrupted && result.value.report.journalPath).toBe(
      '/h/.agent-config/install-state.pending.json',
    );
    expect(
      result.ok &&
        result.value.interrupted &&
        result.value.report.records.map((record) => [record.path.split('/').at(-1), record.action]),
    ).toEqual([
      ['components.lock', 'removed'],
      ['index.md', 'removed'],
      ['skills', 'switched-back'],
      ['patterns', 'restored-from-backup'],
      ['core', 'removed'],
    ]);
  });

  it('killed after the commit but before the journal is deleted, the finished run is kept and only the journal goes', () => {
    const { machine, paths, sep } = scene();
    const finished = scene();
    runInstall(finished.machine, finished.machine.ports, finished.paths, finished.sep);
    const rule = (call: Call): boolean =>
      call.port === 'fs' &&
      call.method === 'remove' &&
      call.phase === 'before' &&
      String(call.args[0]).endsWith('install-state.pending.json');
    expect(() => runInstall(machine, killWhen(machine.ports, rule), paths, sep)).toThrow(Killed);
    expect(composeState(machine.ports).restoreFromJournal()).toEqual({
      ok: true,
      value: { interrupted: false, discarded: true },
    });
    expect(visible(machine)).toEqual(visible(finished.machine));
  });

  it('a run that was not killed leaves no journal and nothing to restore', () => {
    const { machine, paths, sep } = scene();
    runInstall(machine, machine.ports, paths, sep);
    expect(composeState(machine.ports).restoreFromJournal()).toEqual({
      ok: true,
      value: { interrupted: false, discarded: false },
    });
  });
});

describe('EDGE-4 on Windows a switch is a removal and a creation, and a kill between them is restorable', () => {
  it('mid-switch: the old link is created again', () => {
    const { machine, paths, sep } = scene('win32');
    const before = visible(machine);
    const rule = (call: Call): boolean =>
      call.port === 'links' &&
      call.method === 'removeLink' &&
      call.phase === 'after' &&
      String(call.args[0]).endsWith('skills');
    expect(() => runInstall(machine, killWhen(machine.ports, rule), paths, sep)).toThrow(Killed);
    expect(composeState(machine.ports).restoreFromJournal().ok).toBe(true);
    expect(visible(machine)).toEqual(before);
  });
});

describe('DR-205, M-03 a journal that cannot be replayed is kept and nothing changes', () => {
  const journalPath = '/h/.agent-config/install-state.pending.json';
  const withJournal = (text: string) => {
    const { machine } = scene();
    machine.disk.seedFile(journalPath, text);
    return machine;
  };

  it.each([
    ['truncated', '{"schema":"install-journal/v1","home":'],
    ['not a journal', '{"hello":1}'],
    ['empty', ''],
  ])('a %s journal is refused and left in place', (_title, text) => {
    const machine = withJournal(text);
    const before = machine.disk.listing();
    const result = composeState(machine.ports).restoreFromJournal();
    expect(result.ok).toBe(false);
    expect(machine.disk.listing()).toEqual(before);
  });

  it('a journal that names a path outside every root is refused before anything is undone', () => {
    const journal = JSON.stringify({
      schema: 'install-journal/v1',
      home: '/h/.agent-config',
      command: 'install',
      started: 'x',
      operations: [
        { op: 'link', path: '/h/.agent-config/core', kind: 'symlink', target: '/t', old: { state: 'absent' } },
        { op: 'write', path: '/etc/passwd', hash: 'b'.repeat(64), old: { state: 'absent' } },
      ],
    });
    const machine = withJournal(journal);
    machine.disk.seedLink('/h/.agent-config/core', '/t');
    const before = machine.disk.listing();
    const result = composeState(machine.ports).restoreFromJournal();
    expect(result.ok === false && result.error.kind).toBe('outside');
    expect(machine.disk.listing()).toEqual(before);
  });

  it('a journal that names a path below a link that leaves the root is refused', () => {
    const journal = JSON.stringify({
      schema: 'install-journal/v1',
      home: '/h/.agent-config',
      command: 'install',
      started: 'x',
      operations: [{ op: 'write', path: '/h/.agent-config/out/file', hash: 'b'.repeat(64), old: { state: 'absent' } }],
    });
    const machine = withJournal(journal);
    machine.disk.seedFolder('/outside');
    machine.disk.seedFile('/outside/file', 'x');
    machine.disk.seedLink('/h/.agent-config/out', '/outside');
    const result = composeState(machine.ports).restoreFromJournal();
    expect(result.ok === false && result.error.kind).toBe('outside');
    expect(machine.disk.listing()).toContain('/outside/file file 644 "x"');
  });

  it('leaves what V changed: an edited generated file is not removed', () => {
    const { machine, paths } = scene();
    const journal = JSON.stringify({
      schema: 'install-journal/v1',
      home: '/h/.agent-config',
      command: 'install',
      started: 'x',
      operations: [{ op: 'write', path: paths.index, hash: sha256Hex('ours'), old: { state: 'absent' } }],
    });
    machine.disk.seedFile(journalPath, journal);
    machine.disk.seedFile(paths.index, 'V edited this');
    const result = composeState(machine.ports).restoreFromJournal();
    expect(result.ok && result.value.interrupted && result.value.report.records[0]?.action).toBe('left');
    expect(machine.ports.fs.readFile(paths.index as never)).toBe('V edited this');
  });
});
