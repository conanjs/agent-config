// DR-306: the pure planner. What each wanted link becomes given what is at its path, which generated files are rewritten, which links of
// the last run are removed, and how two components that want one path are refused.
import { describe, expect, it } from 'vitest';
import type { ComponentManifest, SlotTable } from '#manifests/application/ManifestTypes.ts';
import {
  mountLinks,
  obsoleteLinks,
  planChangesDisk,
  sharedFolders,
  stepFor,
  storeIdOf,
  writeSteps,
  type DesiredLink,
  type InstalledComponent,
} from '#commands/application/install/PlanInstall.ts';

const slots: SlotTable = {
  slots: [
    {
      name: 'knowledge-storage',
      reserved: false,
      contracts: ['knowledge-provider/v1'],
      required: false,
      multiple: false,
      scope: 'global',
      selfContained: true,
      locations: [
        { name: 'content', mount: 'knowledge', required: true, shared: false, index: 'provided' },
        { name: 'framework', mount: 'frameworks/knowledge', required: true, shared: false, index: undefined },
      ],
    },
    {
      name: 'company-knowledge-storage',
      reserved: false,
      contracts: ['company-kb/v1'],
      required: false,
      multiple: true,
      scope: 'global',
      selfContained: false,
      locations: [{ name: 'content', mount: 'companies', required: true, shared: true, index: 'generated' }],
    },
  ],
};

function component(
  name: string,
  slot: string,
  locations: Record<string, string>,
  root = `/src/${name}`,
): InstalledComponent {
  const manifest = { name, slot, locations } as unknown as ComponentManifest;
  return {
    name,
    slot,
    manifest,
    origin: 'path',
    sourceRoot: root,
    contentRoot: root,
    git: undefined,
    storeId: undefined,
  };
}

const context = { home: '/h/.agent-config', flavor: 'posix' as const };

describe('the links of the mounts', () => {
  it('links a folder as a whole and puts the parent of a nested mount in the folders to make', () => {
    const kb = component('kb', 'knowledge-storage', { content: 'knowledge', framework: 'frameworks/knowledge' });
    const plan = mountLinks([kb], slots, { ...context, entries: new Map() });
    expect(plan).toEqual({
      ok: true,
      value: {
        links: [
          { path: '/h/.agent-config/knowledge', target: '/src/kb/knowledge', class: 'linked', component: 'kb' },
          {
            path: '/h/.agent-config/frameworks/knowledge',
            target: '/src/kb/frameworks/knowledge',
            class: 'linked',
            component: 'kb',
          },
        ],
        folders: ['/h/.agent-config/frameworks'],
      },
    });
  });

  it('links a shared location entry by entry and makes the mount a real folder', () => {
    const notes = component('notes', 'company-knowledge-storage', { content: 'companies' });
    const entries = new Map([['/src/notes/companies', ['notes', 'ots']]]);
    expect(sharedFolders([notes], slots, 'posix')).toEqual(['/src/notes/companies']);
    const plan = mountLinks([notes], slots, { ...context, entries });
    expect(plan.ok && plan.value.links.map((link) => link.path)).toEqual([
      '/h/.agent-config/companies/notes',
      '/h/.agent-config/companies/ots',
    ]);
    expect(plan.ok && plan.value.folders).toEqual(['/h/.agent-config/companies']);
  });

  it('refuses two components that place the same entry, naming both', () => {
    const one = component('one', 'company-knowledge-storage', { content: 'companies' }, '/src/one');
    const two = component('two', 'company-knowledge-storage', { content: 'companies' }, '/src/two');
    const entries = new Map([
      ['/src/one/companies', ['ots']],
      ['/src/two/companies', ['ots']],
    ]);
    expect(mountLinks([one, two], slots, { ...context, entries })).toEqual({
      ok: false,
      error: 'components one and two both place /h/.agent-config/companies/ots',
    });
  });

  it('skips a location the manifest does not map', () => {
    const kb = component('kb', 'knowledge-storage', { content: 'knowledge' });
    const plan = mountLinks([kb], slots, { ...context, entries: new Map() });
    expect(plan.ok && plan.value.links).toHaveLength(1);
  });
});

describe('what happens to one wanted link', () => {
  const wanted: DesiredLink = {
    path: '/h/.agent-config/knowledge',
    target: '/src/kb/knowledge',
    class: 'linked',
    component: 'kb',
  };
  const entry = {
    path: wanted.path,
    class: 'linked' as const,
    kind: 'symlink' as const,
    component: 'kb',
    privileged: false,
    target: '/old',
  };

  it.each([
    ['nothing there', { kind: 'absent' as const }, undefined, 'create'],
    ['the right link', { kind: 'link' as const, target: wanted.target }, undefined, 'unchanged'],
    ['the installers own link to an old target', { kind: 'link' as const, target: '/old' }, entry, 'switch'],
    ['a link the installer did not place', { kind: 'link' as const, target: '/old' }, undefined, 'replace'],
    ['a real folder', { kind: 'folder' as const }, undefined, 'replace'],
    ['a real file', { kind: 'file' as const }, undefined, 'replace'],
  ])('%s gives %s', (_name, observed, recorded, how) => {
    expect(stepFor(wanted, observed, recorded)).toMatchObject({ how });
  });

  it('blocks a path that holds something that cannot be backed up', () => {
    expect(stepFor(wanted, { kind: 'other' }, undefined)).toEqual({ path: wanted.path });
    expect(stepFor(wanted, { kind: 'unknown' }, undefined)).toEqual({ path: wanted.path });
  });
});

describe('the generated files (FR-026, AC-16.7)', () => {
  const file = { relativePath: 'generated/index.md' as const, text: 'same', hash: 'a'.repeat(64) };

  it('rewrites a file whose text on disk does not hash to the plan', () => {
    const steps = writeSteps([file], '/h/.agent-config', 'posix', {
      onDisk: new Map([[file.relativePath, 'same']]),
      recorded: new Map(),
    });
    expect(steps[0]?.unchanged).toBe(false);
  });

  it('is unchanged only when the text on disk hashes to the plan and the last run recorded that hash', () => {
    const text = 'content';
    const planned = { ...file, text };
    // The hash of "content" is written out so the test needs no hash helper of its own.
    const hash = 'ed7002b439e9ac845f22357d822bac1444730fbdb6016d3ec9432297b9ec9f73';
    const step = writeSteps([{ ...planned, hash }], '/h/.agent-config', 'posix', {
      onDisk: new Map([[file.relativePath, text]]),
      recorded: new Map([[file.relativePath, hash]]),
    })[0];
    expect(step).toMatchObject({ unchanged: true, exists: true, path: '/h/.agent-config/generated/index.md' });
  });

  it('rewrites a file V edited, and a file that is gone', () => {
    const edited = writeSteps([file], '/h/.agent-config', 'posix', {
      onDisk: new Map([[file.relativePath, 'edited']]),
      recorded: new Map([[file.relativePath, file.hash]]),
    })[0];
    const gone = writeSteps([file], '/h/.agent-config', 'posix', {
      onDisk: new Map([[file.relativePath, undefined]]),
      recorded: new Map([[file.relativePath, file.hash]]),
    })[0];
    expect([edited?.unchanged, edited?.exists, gone?.unchanged, gone?.exists]).toEqual([false, true, false, false]);
  });
});

describe('links of the last run that are no longer wanted', () => {
  const recorded = (path: string, target: string) => ({
    path,
    class: 'linked' as const,
    kind: 'symlink' as const,
    component: 'old',
    privileged: false,
    target,
  });

  it('removes only a link that is still the installers own and is not wanted', () => {
    const previous = [recorded('/a', '/t1'), recorded('/b', '/t2'), recorded('/c', '/t3'), recorded('/d', '/t4')];
    const observed = new Map([
      ['/a', { kind: 'link' as const, target: '/t1' }],
      ['/b', { kind: 'link' as const, target: '/elsewhere' }],
      ['/c', { kind: 'absent' as const }],
      ['/d', { kind: 'link' as const, target: '/t4' }],
    ]);
    expect(obsoleteLinks(previous, new Set(['/d']), observed)).toEqual([
      { path: '/a', target: '/t1', kind: 'symlink' },
    ]);
  });
});

describe('the plan and the store id', () => {
  const empty = {
    folders: [],
    writes: [],
    links: [],
    unlinks: [],
    compat: { operations: [], unchanged: [], skipped: [], ensureFolders: [] },
  };

  it('changes nothing on disk when every link is unchanged and every file is current', () => {
    expect(planChangesDisk(empty)).toBe(false);
    expect(planChangesDisk({ ...empty, unlinks: [{ path: '/a', target: '/t', kind: 'symlink' }] })).toBe(true);
  });

  it('gives 12 hex characters that depend on the commit and the home', () => {
    const one = storeIdOf('a'.repeat(40), '/h/.agent-config');
    expect(one).toMatch(/^[0-9a-f]{12}$/);
    expect(storeIdOf('b'.repeat(40), '/h/.agent-config')).not.toBe(one);
    expect(storeIdOf('a'.repeat(40), '/other')).not.toBe(one);
  });
});
