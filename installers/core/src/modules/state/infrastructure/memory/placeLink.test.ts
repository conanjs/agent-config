// DR-202, C-7, M-03, M-04, EDGE-3: placing a link, with the Windows ladder, and a path that is refused.
import { describe, expect, it } from 'vitest';
import { placeLink } from '#state/application/links/placeLink.ts';
import { switchLinks } from '#state/application/journal/switchLinks.ts';
import type { Links, LinkKind } from '#state/application/ports/Links.ts';
import type { StateDeps } from '#state/application/StateDeps.ts';
import { createMemoryState } from '#state/infrastructure/memory/MemoryState.ts';

function denying(links: Links, denied: readonly LinkKind[]): Links {
  return {
    ...links,
    createLink(path, target, kind) {
      if (denied.includes(kind)) throw Object.assign(new Error('EPERM: not permitted'), { code: 'EPERM' });
      links.createLink(path, target, kind);
    },
  };
}

describe('placing a link on POSIX', () => {
  function posix() {
    const machine = createMemoryState();
    machine.disk.seedFolder('/h/.agent-config/store/core@0123456789ab');
    machine.disk.seedFolder('/h/.agent-config/store/core@aaaaaaaaaaaa');
    return machine;
  }
  const request = {
    path: '/h/.copilot/patterns',
    target: '/h/.agent-config/store/core@0123456789ab',
    kind: 'symlink',
  } as const;

  it('creates a link where nothing is', () => {
    const machine = posix();
    expect(placeLink(machine.ports, request)).toEqual({
      ok: true,
      value: { kind: 'symlink', degraded: false, how: 'created' },
    });
    expect(machine.ports.links.readLink('/h/.copilot/patterns' as never)).toBe(request.target);
  });

  it('switches an old link in one step', () => {
    const machine = posix();
    machine.disk.seedLink('/h/.copilot/patterns', '/h/.agent-config/store/core@aaaaaaaaaaaa');
    expect(placeLink(machine.ports, request)).toEqual({
      ok: true,
      value: { kind: 'symlink', degraded: false, how: 'switched' },
    });
    expect(machine.ports.links.readLink('/h/.copilot/patterns' as never)).toBe(request.target);
  });

  it('leaves a link that already has the target', () => {
    const machine = posix();
    machine.disk.seedLink('/h/.copilot/patterns', request.target);
    const before = machine.disk.listing();
    expect(placeLink(machine.ports, request)).toEqual({
      ok: true,
      value: { kind: 'symlink', degraded: false, how: 'already' },
    });
    expect(machine.disk.listing()).toEqual(before);
  });

  it('AC-7.3 never replaces a real folder; the caller backs it up and says so in the journal', () => {
    const machine = posix();
    machine.disk.seedFile('/h/.copilot/patterns/mine.md', 'mine');
    expect(placeLink(machine.ports, request)).toMatchObject({ ok: false, error: { kind: 'occupied' } });
    expect(machine.disk.listing()).toContain('/h/.copilot/patterns/mine.md file 644 "mine"');
  });

  it('M-03 refuses a link path outside every root', () => {
    const machine = posix();
    expect(placeLink(machine.ports, { ...request, path: '/etc/evil' })).toMatchObject({
      ok: false,
      error: { kind: 'outside' },
    });
  });

  it('M-04 refuses a target outside every root', () => {
    const machine = posix();
    expect(placeLink(machine.ports, { ...request, target: '/etc' })).toMatchObject({
      ok: false,
      error: { kind: 'outside' },
    });
  });

  it('M-04 refuses a link path below a link that leaves its root', () => {
    const machine = posix();
    machine.disk.seedFolder('/outside');
    machine.disk.seedLink('/h/.copilot/sub', '/outside');
    expect(placeLink(machine.ports, { ...request, path: '/h/.copilot/sub/patterns' })).toMatchObject({
      ok: false,
      error: { kind: 'outside' },
    });
    expect(machine.disk.listing().filter((line) => line.startsWith('/outside/'))).toEqual([]);
  });

  it('EDGE-3 a refusal of the disk to make links is thrown with its code, for MG-38', () => {
    const machine = posix();
    const deps: StateDeps = { ...machine.ports, links: denying(machine.ports.links, ['symlink', 'junction']) };
    expect(() => placeLink(deps, request)).toThrow(/EPERM/);
  });
});

describe('C-7 the Windows ladder', () => {
  function windows() {
    const machine = createMemoryState('win32');
    machine.disk.seedFolder('C:\\h\\.agent-config\\store\\core@0123456789ab');
    machine.disk.seedFile('C:\\h\\.agent-config\\settings.json', '{}');
    return machine;
  }
  const folder = {
    path: 'C:\\h\\.copilot\\patterns',
    target: 'C:\\h\\.agent-config\\store\\core@0123456789ab',
    kind: 'symlink',
  } as const;
  const file = {
    path: 'C:\\h\\.claude\\settings.json',
    target: 'C:\\h\\.agent-config\\settings.json',
    kind: 'symlink',
  } as const;

  it('uses a symbolic link when the account may', () => {
    expect(placeLink(windows().ports, folder)).toEqual({
      ok: true,
      value: { kind: 'symlink', degraded: false, how: 'created' },
    });
  });

  it('falls back to a junction for a folder and reports it as degraded', () => {
    const machine = windows();
    const deps: StateDeps = { ...machine.ports, links: denying(machine.ports.links, ['symlink']) };
    expect(placeLink(deps, folder)).toEqual({ ok: true, value: { kind: 'junction', degraded: true, how: 'created' } });
  });

  it('falls back to a hash-tracked copy for a file and reports it as degraded', () => {
    const machine = windows();
    const deps: StateDeps = { ...machine.ports, links: denying(machine.ports.links, ['symlink', 'junction']) };
    expect(placeLink(deps, file)).toEqual({ ok: true, value: { kind: 'copy', degraded: true, how: 'created' } });
    expect(machine.ports.fs.readFile('C:\\h\\.claude\\settings.json' as never)).toBe('{}');
  });

  it('fails for a folder when neither a symbolic link nor a junction may be made, so the install exits 1', () => {
    const machine = windows();
    const deps: StateDeps = { ...machine.ports, links: denying(machine.ports.links, ['symlink', 'junction']) };
    expect(() => placeLink(deps, folder)).toThrow(/EPERM/);
  });

  it('has no atomic switch: an old link is removed, then created', () => {
    const machine = windows();
    machine.disk.seedLink('C:\\h\\.copilot\\patterns', 'C:\\h\\.agent-config\\old');
    const calls: string[] = [];
    const links: Links = {
      ...machine.ports.links,
      removeLink: (path) => {
        calls.push('removeLink');
        machine.ports.links.removeLink(path);
      },
      createLink: (path, target, kind) => {
        calls.push('createLink');
        machine.ports.links.createLink(path, target, kind);
      },
      switchLink: () => {
        calls.push('switchLink');
      },
    };
    expect(placeLink({ ...machine.ports, links }, folder)).toEqual({
      ok: true,
      value: { kind: 'symlink', degraded: false, how: 'switched' },
    });
    expect(calls).toEqual(['removeLink', 'createLink']);
  });
});

describe('DR-202 switching the links of a journal', () => {
  const journal = (backup: string) => ({
    home: '/h/.agent-config',
    command: 'install',
    started: 'now',
    operations: [
      {
        op: 'link' as const,
        path: '/h/.copilot/patterns',
        kind: 'symlink' as const,
        target: '/h/.agent-config/patterns',
        old: { state: 'backed-up' as const, backup },
      },
    ],
  });

  function setup() {
    const machine = createMemoryState();
    machine.disk.seedFolder('/h/.agent-config/patterns');
    machine.disk.seedFile('/h/.copilot/patterns/mine.md', 'mine');
    return machine;
  }

  it('replaces a real folder only when the journal says it was backed up and the backup exists', () => {
    const machine = setup();
    machine.disk.seedFolder('/h/.agent-config-backups/20261120091403/1-patterns');
    const result = switchLinks(machine.ports, journal('/h/.agent-config-backups/20261120091403/1-patterns'));
    expect(result.ok && result.value.map((link) => link.placed.how)).toEqual(['created']);
    expect(machine.ports.links.readLink('/h/.copilot/patterns' as never)).toBe('/h/.agent-config/patterns');
  });

  it('refuses to replace a real folder when its backup is missing, and the folder stays', () => {
    const machine = setup();
    const result = switchLinks(machine.ports, journal('/h/.agent-config-backups/20261120091403/1-patterns'));
    expect(result).toMatchObject({ ok: false, error: { refusal: { kind: 'backup-missing' } } });
    expect(machine.disk.listing()).toContain('/h/.copilot/patterns/mine.md file 644 "mine"');
  });

  it('refuses a backup path outside the roots', () => {
    const machine = setup();
    expect(switchLinks(machine.ports, journal('/etc/backup'))).toMatchObject({
      ok: false,
      error: { refusal: { kind: 'outside' } },
    });
  });

  it('skips a write operation and a link that is already in place, so a restored run can be completed again', () => {
    const machine = setup();
    machine.disk.seedFolder('/h/.agent-config-backups/20261120091403/1-patterns');
    const first = journal('/h/.agent-config-backups/20261120091403/1-patterns');
    switchLinks(machine.ports, first);
    const again = switchLinks(machine.ports, {
      ...first,
      operations: [
        ...first.operations,
        { op: 'write', path: '/h/.agent-config/x', hash: 'a'.repeat(64), old: { state: 'absent' } },
      ],
    });
    expect(again.ok && again.value.map((link) => link.placed.how)).toEqual(['already']);
  });
});
