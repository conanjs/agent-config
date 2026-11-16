// T131 on a real temporary folder: the module reads real files and real links through its Node adapters, so a hostile manifest, a
// link that leaves a component and a file that is too large are tested as the installer meets them (M-03, M-04, M-07, M-17).
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { composeManifests } from '#manifests/ManifestsModule.ts';
import type { ManifestsApi } from '#manifests/application/ManifestsApi.ts';
import type { ManifestDeps } from '#manifests/application/ManifestDeps.ts';
import { pathSourceProblem } from '#manifests/application/read/checkPathSource.ts';
import { mergeLists, splitArchiveEntries } from '#manifests/application/ListOperations.ts';
import {
  renderComponentWarning,
  renderFileIssue,
  renderOverride,
  renderPathSourceRefused,
  renderSkipWarning,
} from '#manifests/application/messages/renderManifestMessages.ts';
import type { SlotTable } from '#manifests/application/ManifestTypes.ts';
import { createNodeManifestPorts } from '#manifests/infrastructure/NodeManifestPorts.ts';

const repoRoot = path.resolve(import.meta.dirname, '../../../../..');
const gitPolicy = { allowedProtocols: ['https', 'ssh'] } as const;

let temp = '';
let deps: ManifestDeps;
let api: ManifestsApi;

beforeEach(() => {
  temp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'manifests-')));
  deps = { ports: createNodeManifestPorts(), flavor: 'posix', gitPolicy };
  api = composeManifests(deps);
});
afterEach(() => {
  fs.rmSync(temp, { recursive: true, force: true });
});

function put(file: string, text: string): string {
  const target = path.join(temp, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, text);
  return target;
}

const manifest = (changes: readonly (readonly [string, string])[] = []): string =>
  changes.reduce((text, [from, to]) => {
    expect(text).toContain(from);
    return text.replace(from, to);
  }, ['schema: component/v1', 'name: comp', 'version: 1.0.0', 'slot: framework', 'repository: https://github.com/conanjs/comp', 'scope: per-project', 'contracts:', '  pin: 1', 'locations:', '  framework: .', 'provides:', '  contracts: [framework/v1]', '  index: index.md', '  exports: [framework/guide.md]', 'routes:', '  - id: comp-route', '    when: always', '    read: frameworks/comp/index.md', ''].join('\n'));

function slots(): SlotTable {
  const read = api.readSlots({ root: repoRoot });
  if (!read.ok) throw new Error('contracts/slots.yaml must be readable');
  return read.value;
}

const readComp = (root: string, name = 'comp', kind: 'clone' | 'core' = 'clone') =>
  api.readComponent({ name, root, slots: slots(), source: { kind } });

function skipLine(root: string, name = 'comp'): string {
  const read = readComp(root, name);
  if (read.kind !== 'skipped') throw new Error(`expected a skip, got ${read.kind}`);
  return renderSkipWarning(read.skip);
}

describe('slots file (FR-003, SL-3)', () => {
  it('reads the real contracts/slots.yaml', () => {
    expect(slots().slots.map((slot) => slot.name)).toEqual([
      'core',
      'knowledge-storage',
      'company-knowledge-storage',
      'framework',
    ]);
  });

  it.each([
    [
      'a slot name twice',
      'slots:\n  - { name: a, contract: x/v1, required: false, multiple: false, scope: global, locations: [{ name: l, mount: m1 }] }\n  - { name: a, contract: x/v1, required: false, multiple: false, scope: global, locations: [{ name: l, mount: m2 }] }\n',
      'appears twice',
    ],
    [
      'a mount used twice',
      'slots:\n  - { name: a, contract: x/v1, required: false, multiple: false, scope: global, locations: [{ name: l, mount: m }] }\n  - { name: b, contract: x/v1, required: false, multiple: false, scope: global, locations: [{ name: l, mount: m }] }\n',
      'used by another location',
    ],
    [
      'the old count key',
      'slots:\n  - { name: a, contract: x/v1, count: one, required: false, multiple: false, scope: global, locations: [{ name: l, mount: m }] }\n',
      'count',
    ],
    [
      'a mount that climbs out',
      'slots:\n  - { name: a, contract: x/v1, required: false, multiple: false, scope: global, locations: [{ name: l, mount: ../x }] }\n',
      '..',
    ],
  ])('refuses %s', (_title, body, sentence) => {
    put('checkout/contracts/slots.yaml', `schema: slots/v1\n${body}`);
    const read = api.readSlots({ root: path.join(temp, 'checkout') });
    expect(read.ok).toBe(false);
    if (!read.ok) expect(renderFileIssue(read.error.file, read.error.issues[0]!)).toContain(sentence);
  });

  it('refuses a missing file naming its path', () => {
    fs.mkdirSync(path.join(temp, 'checkout'));
    const read = api.readSlots({ root: path.join(temp, 'checkout') });
    expect(read.ok).toBe(false);
    if (!read.ok) expect(read.error.file).toBe(path.join(temp, 'checkout/contracts/slots.yaml'));
  });
});

describe('component lists (M-03, M-05, M-07, M-17)', () => {
  const list = (body: string, local = true): string =>
    `schema: components-list/v1\nlocal: ${local}\ncomponents:\n${body}`;
  const readLocal = (text: string) => {
    put('home/components.local.yaml', text);
    return api.readComponentList({ kind: 'local', root: path.join(temp, 'home') });
  };
  const lines = (read: ReturnType<typeof readLocal>): string[] =>
    read.ok ? [] : read.error.issues.map((issue) => renderFileIssue(read.error.file, issue));

  it('reads git, path and archive entries', () => {
    const read = readLocal(
      list(
        [
          '  - { name: a, source: { type: git, url: "https://example.invalid/a.git", ref: main } }',
          `  - { name: b, source: { type: path, path: ${temp}/b } }`,
          `  - { name: c, source: { type: archive, url: "https://example.invalid/c.tgz", sha256: "${'0'.repeat(64)}" } }`,
          '',
        ].join('\n'),
      ),
    );
    expect(read.ok && read.value.entries.map((entry) => entry.source.type)).toEqual(['git', 'path', 'archive']);
  });

  it('treats an absent local list as empty and marked not present', () => {
    fs.mkdirSync(path.join(temp, 'home'));
    const read = api.readComponentList({ kind: 'local', root: path.join(temp, 'home') });
    expect(read).toEqual({ ok: true, value: { local: true, entries: [], present: false } });
  });

  it('treats a missing home as an absent local list', () => {
    const read = api.readComponentList({ kind: 'local', root: path.join(temp, 'no-home') });
    expect(read.ok && read.value.present).toBe(false);
  });

  it.each([
    [
      'a name with a traversal',
      '  - { name: ../evil, source: { type: git, url: "https://e.invalid/x.git", ref: main } }\n',
    ],
    ['a Windows device name', '  - { name: con, source: { type: git, url: "https://e.invalid/x.git", ref: main } }\n'],
    [
      'a ref that starts with a dash',
      '  - { name: evil, source: { type: git, url: "https://e.invalid/x.git", ref: "-oProxyCommand=x" } }\n',
    ],
    [
      'a host that starts with a dash',
      '  - { name: evil, source: { type: git, url: "ssh://-oProxyCommand=x/x.git", ref: main } }\n',
    ],
    ['an ext transport', '  - { name: evil, source: { type: git, url: "ext::sh -c x", ref: main } }\n'],
    ['a file transport', '  - { name: evil, source: { type: git, url: "file:///etc", ref: main } }\n'],
    ['a relative path source', '  - { name: evil, source: { type: path, path: ../elsewhere } }\n'],
    ['a path source with NUL', '  - { name: evil, source: { type: path, path: "a\\0b" } }\n'],
    [
      'the same name twice',
      '  - { name: a, source: { type: path, path: /x } }\n  - { name: a, source: { type: path, path: /y } }\n',
    ],
    ['an unknown source type', '  - { name: a, source: { type: svn, url: x } }\n'],
  ])('refuses the whole list for %s and prints MG-23', (_title, body) => {
    const printed = lines(readLocal(list(body)));
    expect(printed.length).toBeGreaterThan(0);
    for (const line of printed)
      expect(line).toMatch(new RegExp(`^error: ${temp}/home/components.local.yaml is invalid: `));
  });

  it.each([
    ['https user and password', 'https://vinh:s3cr3t-fake@example.invalid/kb.git'],
    ['https user only', 'https://vinh@example.invalid/kb.git'],
    ['ssh with a password', 'ssh://git:s3cr3t-fake@example.invalid/kb.git'],
  ])('M-07 %s names the component only and prints no part of the address', (_title, url) => {
    const printed = lines(readLocal(list(`  - { name: kb-g, source: { type: git, url: '${url}', ref: main } }\n`)));
    expect(printed).toEqual([
      "error: component kb-g has a source URL with credentials; keep credentials in git's credential helper or ssh-agent (M-07)",
    ]);
    expect(printed.join('\n')).not.toContain('s3cr3t');
    expect(printed.join('\n')).not.toContain('vinh');
  });

  it('M-07 allows the plain ssh user git', () => {
    const read = readLocal(
      list('  - { name: kb, source: { type: git, url: "ssh://git@example.invalid/kb.git", ref: main } }\n'),
    );
    expect(read.ok).toBe(true);
  });

  it('M-07 a query token in a source address is refused without echoing it', () => {
    const printed = lines(
      readLocal(
        list('  - { name: kb, source: { type: git, url: "https://e.invalid/kb.git?token=SECRETQUERY", ref: main } }\n'),
      ),
    );
    expect(printed.length).toBe(1);
    expect(printed.join('\n')).not.toContain('SECRETQUERY');
  });

  it('M-05 the git policy narrows the transports a list may name', () => {
    const narrow = composeManifests({ ...deps, gitPolicy: { allowedProtocols: ['ssh'] } });
    put(
      'home/components.local.yaml',
      list('  - { name: kb, source: { type: git, url: "https://e.invalid/kb.git", ref: main } }\n'),
    );
    const read = narrow.readComponentList({ kind: 'local', root: path.join(temp, 'home') });
    expect(read.ok).toBe(false);
    if (!read.ok)
      expect(renderFileIssue(read.error.file, read.error.issues[0]!)).toContain('must start with ssh:// (M-05)');
  });

  it.each([
    ['a custom tag', 'schema: components-list/v1\nlocal: true\ncomponents: !custom []\n', 'a tag is not allowed'],
    [
      'an alias',
      'schema: components-list/v1\nlocal: true\nx: &a [1]\ny: *a\ncomponents: []\n',
      'aliases (*name) are not allowed',
    ],
    [
      'a second document',
      'schema: components-list/v1\nlocal: true\ncomponents: []\n---\nx: 1\n',
      'more than one document',
    ],
    [
      'a text over 256 KiB',
      `schema: components-list/v1\nlocal: true\ncomponents: []\n${'#'.repeat(300_000)}\n`,
      'byte limit',
    ],
    ['an unsupported major', 'schema: components-list/v9\nlocal: true\ncomponents: []\n', 'v9'],
    [
      'the wrong local flag',
      'schema: components-list/v1\nlocal: false\ncomponents: []\n',
      'must be true in the local list',
    ],
  ])('M-17 %s fails the list as a whole', (_title, text, sentence) => {
    expect(lines(readLocal(text)).join('\n')).toContain(sentence);
  });

  it('refuses a list file that is a link out of its folder', () => {
    put('outside/list.yaml', list(''));
    fs.mkdirSync(path.join(temp, 'home'), { recursive: true });
    fs.symlinkSync(path.join(temp, 'outside/list.yaml'), path.join(temp, 'home/components.local.yaml'));
    const read = api.readComponentList({ kind: 'local', root: path.join(temp, 'home') });
    expect(read.ok).toBe(false);
    if (!read.ok) expect(lines(read)[0]).toContain('leaves its root');
  });

  it('merges local over public by name and prints the override line', () => {
    const publicList = {
      local: false,
      present: true,
      entries: [{ name: 'notes', source: { type: 'path', path: '/pub' } }],
    } as const;
    const localList = {
      local: true,
      present: true,
      entries: [
        { name: 'notes', source: { type: 'path', path: '/loc' } },
        { name: 'more', source: { type: 'path', path: '/m' } },
      ],
    } as const;
    const merged = mergeLists(publicList, localList);
    expect(merged.map((entry) => [entry.name, entry.origin])).toEqual([
      ['notes', 'local'],
      ['more', 'local'],
    ]);
    expect(renderOverride(merged[0]!)).toBe('override: notes: local source /loc replaces public source /pub');
    expect(renderOverride(merged[1]!)).toBeUndefined();
  });

  it('splits archive entries so nothing of them is fetched, and words the skip exactly (AC-3.7)', () => {
    const merged = mergeLists(
      { local: false, present: true, entries: [] },
      {
        local: true,
        present: true,
        entries: [
          { name: 'my-archive', source: { type: 'archive', url: 'https://e.invalid/n.tgz', sha256: '0'.repeat(64) } },
        ],
      },
    );
    const split = splitArchiveEntries(merged);
    expect(split.usable).toEqual([]);
    expect(renderSkipWarning({ name: split.archiveNames[0]!, reason: { kind: 'archive' } })).toBe(
      'warning: component my-archive is skipped: source type archive not supported in this release',
    );
  });
});

describe('component folders', () => {
  const component = (changes: readonly (readonly [string, string])[] = [], root = 'src/comp'): string => {
    put(`${root}/component.yaml`, manifest(changes));
    put(`${root}/index.md`, '# comp\n');
    put(`${root}/guide.md`, 'x\n');
    return path.join(temp, root);
  };

  it('loads a valid component', () => {
    const root = component();
    const read = readComp(root);
    expect(read.kind).toBe('loaded');
    if (read.kind === 'loaded') {
      expect(read.manifest.slot).toBe('framework');
      expect(read.manifest.provides.exports).toEqual(['framework/guide.md']);
      expect(read.manifest.routes[0]?.read).toBe('frameworks/comp/index.md');
    }
  });

  it('says the folder is missing, so a moved path source fails with MG-31 and is not skipped (AC-3.3)', () => {
    expect(readComp(path.join(temp, 'missing'))).toEqual({
      kind: 'folder-missing',
      name: 'comp',
      folder: path.join(temp, 'missing'),
    });
  });

  it('skips a folder with no component.yaml with the exact text (AC-3.5)', () => {
    fs.mkdirSync(path.join(temp, 'work/notes'), { recursive: true });
    expect(skipLine(path.join(temp, 'work/notes'), 'notes')).toBe(
      `warning: component notes is skipped: no component.yaml in ${temp}/work/notes`,
    );
  });

  it('skips a component whose slot is not in slots/v1 (AC-5.8)', () => {
    expect(skipLine(component([['slot: framework', 'slot: nowhere']]))).toBe(
      'warning: component comp is skipped: slot nowhere is not in slots/v1',
    );
  });

  it('skips a list component that names the reserved core slot, but reads it as the core component', () => {
    const changes = [
      ['slot: framework', 'slot: core'],
      ['  framework: .', '  core: .'],
    ] as const;
    const root = component(changes);
    expect(skipLine(root)).toContain('reserved for agent-config');
    expect(readComp(root, 'comp', 'core').kind).toBe('skipped'); // core still needs its other seven locations
    expect(skipLine(root)).not.toContain('is not in slots/v1');
  });

  it.each([
    [
      'a required location left out',
      [['  framework: .', '  other: .']] as const,
      'locations.framework is required by slot framework',
    ],
    [
      'a location the slot lacks',
      [['  framework: .', '  framework: .\n  extra: .']] as const,
      'locations.extra is not a location of slot framework',
    ],
    [
      'a name that differs from the list',
      [['name: comp', 'name: other']] as const,
      'name does not match the name in the list',
    ],
  ])('skips for %s', (_title, changes, sentence) => {
    expect(skipLine(component(changes))).toContain(sentence);
  });

  it.each([
    ['name', 'name: comp', 'name: ../trav'],
    ['location', '  framework: .', '  framework: ../../outside'],
    ['index', 'index: index.md', 'index: ../index.md'],
    ['export', 'exports: [framework/guide.md]', 'exports: [../secret.md]'],
    ['skills folder', 'index: index.md', 'index: index.md\n  skills: /etc/skills'],
    ['agents folder', 'index: index.md', "index: index.md\n  agents: 'C:agents'"],
    ['route read', 'read: frameworks/comp/index.md', "read: '..\\index.md'"],
    ['path with NUL', 'index: index.md', 'index: "a\\0b"'],
    ['hook id', 'routes:', 'hooks:\n  - { id: Trav_Hook, event: stop, command: x }\nroutes:'],
    ['route id', 'id: comp-route', 'id: ../route'],
    ['Windows device folder', 'index: index.md', 'index: nul/index.md'],
    ['trailing dot', 'index: index.md', 'index: index.md.'],
  ])('M-03 a %s that escapes or breaks the rules skips only that component', (_title, from, to) => {
    expect(skipLine(component([[from, to]]))).toMatch(
      /^warning: component comp is skipped: component\.yaml is invalid: /,
    );
  });

  it.each([
    ['a custom tag', [['version: 1.0.0', 'version: !custom 1.0.0']] as const, 'a tag is not allowed'],
    [
      'a credential in a suggested source',
      [
        [
          'routes:',
          'depends:\n  slots:\n    - slot: knowledge-storage\n      contract: knowledge-provider/v1\n      suggest:\n        source: { type: git, url: "https://u:s3cr3t-fake@e.invalid/k.git", ref: main }\nroutes:',
        ],
      ] as const,
      'depends.slots[0].suggest.source.url',
    ],
    [
      'a command detect',
      [
        [
          'routes:',
          'variables:\n  - { name: REF, description: d, detect: { kind: command, command: "touch x" } }\nroutes:',
        ],
      ] as const,
      'variables[0].detect',
    ],
  ])('M-17, M-07, M-18 %s skips and never echoes the value', (_title, changes, sentence) => {
    const line = skipLine(component(changes));
    expect(line).toContain(sentence);
    expect(line).not.toContain('s3cr3t');
    expect(line).not.toContain('touch x');
  });

  it('M-17 aliases (billion laughs) are refused, not expanded', () => {
    const lasers = Array.from(
      { length: 8 },
      (_v, n) => `l${n + 1}: &l${n + 1} [${Array(9).fill(`*l${n}`).join(', ')}]`,
    ).join('\n');
    const root = component();
    fs.appendFileSync(path.join(root, 'component.yaml'), `l0: &l0 [x, x, x]\n${lasers}\n`);
    expect(skipLine(root)).toContain('aliases (*name) are not allowed');
  });

  it('M-17 a manifest over 256 KiB is skipped with the byte limit', () => {
    const root = component();
    fs.appendFileSync(path.join(root, 'component.yaml'), '# padding\n'.repeat(30_000));
    expect(skipLine(root)).toContain('byte limit');
  });

  it('M-17 a manifest of 10 MB is cut at the limit, not read whole', () => {
    const root = component();
    fs.appendFileSync(path.join(root, 'component.yaml'), '#'.repeat(10_000_000));
    expect(skipLine(root)).toContain('byte limit');
  });

  it('M-04 a component.yaml that is a link out of the root is skipped', () => {
    const root = component();
    put('secret/component.yaml', manifest());
    fs.rmSync(path.join(root, 'component.yaml'));
    fs.symlinkSync(path.join(temp, 'secret/component.yaml'), path.join(root, 'component.yaml'));
    expect(skipLine(root)).toBe('warning: component comp is skipped: symlink component.yaml leaves the component root');
  });

  it('M-04 a dangling component.yaml link is skipped', () => {
    const root = component();
    fs.rmSync(path.join(root, 'component.yaml'));
    fs.symlinkSync(path.join(temp, 'gone.yaml'), path.join(root, 'component.yaml'));
    expect(skipLine(root)).toContain('symlink component.yaml leaves the component root');
  });

  it('M-04 a link inside the root to a file outside skips the component and copies nothing', () => {
    const root = component();
    put('home/secret/key.txt', 'TOPSECRET-FAKE');
    fs.mkdirSync(path.join(root, 'docs'));
    fs.symlinkSync(path.join(temp, 'home/secret/key.txt'), path.join(root, 'docs/key.md'));
    const line = skipLine(root);
    expect(line).toBe('warning: component comp is skipped: symlink docs/key.md leaves the component root');
    expect(line).not.toContain('TOPSECRET');
  });

  it('M-04 a link to a folder outside, and a dangling link, skip the component', () => {
    const root = component();
    fs.mkdirSync(path.join(temp, 'outside-dir'));
    fs.symlinkSync(path.join(temp, 'outside-dir'), path.join(root, 'linked-dir'));
    expect(skipLine(root)).toContain('symlink linked-dir leaves');
    fs.rmSync(path.join(root, 'linked-dir'));
    fs.symlinkSync(path.join(temp, 'nothing-here'), path.join(root, 'dangling'));
    expect(skipLine(root)).toContain('symlink dangling leaves');
  });

  it('M-04 a link that stays inside the root is fine', () => {
    const root = component();
    fs.symlinkSync(path.join(root, 'guide.md'), path.join(root, 'alias.md'));
    expect(readComp(root).kind).toBe('loaded');
  });

  it('M-03 a location folder that is a link out of the root is skipped', () => {
    const root = component([['  framework: .', '  framework: sub']]);
    fs.mkdirSync(path.join(temp, 'elsewhere'));
    fs.symlinkSync(path.join(temp, 'elsewhere'), path.join(root, 'sub'));
    expect(skipLine(root)).toContain('symlink sub leaves the component root');
  });

  it('M-04 the listing of links finds them below the root and ignores .git at the root', () => {
    const root = component();
    fs.mkdirSync(path.join(root, '.git'));
    fs.symlinkSync(path.join(temp, 'outside-x'), path.join(root, '.git/hook'));
    expect(api.findEscapingLinks(root)).toEqual({ kind: 'clean' });
    fs.mkdirSync(path.join(root, 'a/b'), { recursive: true });
    fs.symlinkSync('/etc/hosts', path.join(root, 'a/b/h'));
    expect(api.findEscapingLinks(root)).toEqual({ kind: 'escapes', link: 'a/b/h' });
  });

  it('a manifest that is a named pipe is refused at once, not waited on', () => {
    const root = component();
    fs.rmSync(path.join(root, 'component.yaml'));
    // mkfifo is not on every runner; without it the case is not applicable.
    try {
      fs.writeFileSync(path.join(root, 'fifo-probe'), '');
      fs.rmSync(path.join(root, 'fifo-probe'));
      execFileSync('mkfifo', [path.join(root, 'component.yaml')]);
    } catch {
      return;
    }
    expect(skipLine(root)).toContain('component.yaml is invalid');
  });
});

describe('what a path field is on disk (M-03, M-13) and .git (M-04)', () => {
  const root = (): string => {
    put('src/comp/component.yaml', manifest());
    put('src/comp/index.md', '# comp\n');
    return path.join(temp, 'src/comp');
  };
  const rewrite = (folder: string, from: string, to: string): void => {
    const file = path.join(folder, 'component.yaml');
    fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace(from, to));
  };
  const hasMkfifo = ((): boolean => {
    try {
      execFileSync('mkfifo', ['--help'], { stdio: 'ignore' });
      return true;
    } catch {
      return process.platform !== 'win32';
    }
  })();
  const fifo = (target: string): void => {
    execFileSync('mkfifo', [target]);
  };

  it.each([
    [
      'a pipe as a location',
      'framework: .',
      'framework: pipe',
      (r: string) => fifo(path.join(r, 'pipe')),
      'locations.framework must be a folder',
    ],
    [
      'a pipe as provides.index',
      'index: index.md',
      'index: pipe',
      (r: string) => fifo(path.join(r, 'pipe')),
      'provides.index must be a regular file',
    ],
  ])('refuses %s', (_title, from, to, make, sentence) => {
    if (!hasMkfifo) return;
    const folder = root();
    make(folder);
    rewrite(folder, from, to);
    expect(skipLine(folder)).toBe(`warning: component comp is skipped: component.yaml is invalid: ${sentence}`);
  });

  it.each([
    ['a regular file as a location', 'framework: .', 'framework: afile', 'locations.framework must be a folder'],
    ['a missing location folder', 'framework: .', 'framework: nothing', 'locations.framework is not there'],
    ['a folder as provides.index', 'index: index.md', 'index: adir', 'provides.index must be a regular file'],
    ['a missing provides.index', 'index: index.md', 'index: gone.md', 'provides.index is not there'],
    [
      'a regular file as provides.skills',
      'index: index.md',
      'index: index.md\n  skills: afile',
      'provides.skills must be a folder',
    ],
  ])('refuses %s', (_title, from, to, sentence) => {
    const folder = root();
    fs.writeFileSync(path.join(folder, 'afile'), 'x');
    fs.mkdirSync(path.join(folder, 'adir'));
    rewrite(folder, from, to);
    expect(skipLine(folder)).toBe(`warning: component comp is skipped: component.yaml is invalid: ${sentence}`);
  });

  it.each([
    ['.git', '.git'],
    ['.GIT', '.GIT'],
    ['a subfolder of .git', '.git/sub'],
    ['.Git behind ./', './.Git'],
  ])('M-04 refuses the location %s', (_title, written) => {
    const folder = root();
    fs.mkdirSync(path.join(folder, '.git/sub'), { recursive: true });
    rewrite(folder, 'framework: .', `framework: ${written}`);
    expect(skipLine(folder)).toBe(
      'warning: component comp is skipped: component.yaml is invalid: locations.framework must not be inside a .git folder (M-04)',
    );
  });

  it('M-04 refuses a link that ends inside .git even when it is spelled another way', () => {
    const folder = root();
    fs.mkdirSync(path.join(folder, '.git'));
    fs.symlinkSync(path.join(folder, '.git'), path.join(folder, 'alias'));
    rewrite(folder, 'framework: .', 'framework: alias');
    expect(skipLine(folder)).toContain('must not be inside a .git folder (M-04)');
  });

  it('a folder named like .git but longer is fine', () => {
    const folder = root();
    fs.mkdirSync(path.join(folder, '.github'));
    rewrite(folder, 'framework: .', 'framework: .github');
    expect(readComp(folder).kind).toBe('loaded');
  });
});

describe('a path source keeps away from the homes (M-03)', () => {
  const guard = (): { userHome: string; agentHome: string } => ({
    userHome: path.join(temp, 'u'),
    agentHome: path.join(temp, 'u/.agent-config'),
  });
  const folders = (): void => {
    fs.mkdirSync(path.join(temp, 'u/.agent-config/sub'), { recursive: true });
    fs.mkdirSync(path.join(temp, 'other'));
    fs.mkdirSync(path.join(temp, 'work/.agent-config'), { recursive: true });
    fs.symlinkSync(path.join(temp, 'u'), path.join(temp, 'alias-of-home'));
    fs.symlinkSync(path.join(temp, 'u/.agent-config'), path.join(temp, 'alias-of-agent-home'));
  };
  const read = (root: string, chosen = guard()) =>
    api.readComponent({ name: 'comp', root, slots: slots(), source: { kind: 'path', guard: chosen } });
  const home = 'it is your home folder or a folder that holds it, reached by another path';
  const agent = 'it is the agent home or inside it';

  it.each([
    ['the file system root', () => path.parse(temp).root, home],
    ['a folder that holds the user home', () => temp, home],
    ['the user home', () => path.join(temp, 'u'), home],
    ['a link to the user home', () => path.join(temp, 'alias-of-home'), home],
    ['the agent home', () => path.join(temp, 'u/.agent-config'), agent],
    ['a folder inside the agent home', () => path.join(temp, 'u/.agent-config/sub'), agent],
    ['a link to the agent home', () => path.join(temp, 'alias-of-agent-home'), agent],
  ])('refuses %s with MG-31.refused', (_title, root, reason) => {
    folders();
    const folder = root();
    const result = read(folder);
    expect(result).toEqual({ kind: 'source-refused', name: 'comp', folder, reason });
    if (result.kind === 'source-refused') {
      expect(renderPathSourceRefused(result.name, result.folder, result.reason)).toBe(
        `error: component comp: path source folder ${folder} is refused: ${reason} (M-03)`,
      );
    }
  });

  it('refuses a folder that holds the agent home, such as ~/work with the agent home ~/work/.agent-config', () => {
    folders();
    const result = read(path.join(temp, 'work'), {
      userHome: path.join(temp, 'u'),
      agentHome: path.join(temp, 'work/.agent-config'),
    });
    expect(result).toMatchObject({
      kind: 'source-refused',
      reason: 'it holds the agent home, reached by another path',
    });
  });

  it('accepts a folder elsewhere, and a managed clone needs no guard', () => {
    folders();
    put('other/component.yaml', manifest());
    put('other/index.md', '# c\n');
    expect(read(path.join(temp, 'other')).kind).toBe('loaded');
    expect(readComp(path.join(temp, 'other')).kind).toBe('loaded');
  });

  it('refuses when the user home cannot be identified', () => {
    folders();
    const result = read(path.join(temp, 'other'), {
      userHome: path.join(temp, 'no-such-home'),
      agentHome: path.join(temp, 'u/.agent-config'),
    });
    expect(result.kind).toBe('source-refused');
  });
});

describe('a folder that holds the agent home through a firmlink (identity double)', () => {
  // /System/Volumes/Data/Users/v is /Users/v on a Mac; no text relates the two, only the identity does.
  const identities: Record<string, string> = {
    '/Users/w': 'W',
    '/Users': 'U',
    '/': 'R',
    '/System/Volumes/Data': 'D',
    '/System/Volumes': 'V',
    '/System': 'S',
    '/Users/v/.agent-config': 'A',
    '/System/Volumes/Data/Users/v/.agent-config': 'A',
  };
  const doubleDeps = (table: Record<string, string>): ManifestDeps => ({
    flavor: 'posix',
    gitPolicy,
    ports: {
      ...createNodeManifestPorts(),
      probe: {
        realPath: (target) => ({ kind: 'real', path: target }),
        isLink: () => 'not-link',
        identity: (target) => {
          const key = table[target];
          return key === undefined
            ? { kind: 'missing' }
            : { kind: 'identity', dev: 1n, ino: BigInt(key.charCodeAt(0)) };
        },
      },
    },
  });
  const guard = { userHome: '/Users/w', agentHome: '/Users/v/.agent-config' };

  it.each([
    ['the firmlink folder', '/System/Volumes/Data', 'it holds the agent home, reached by another path'],
    ['a folder elsewhere', '/System/Volumes', undefined],
  ])('%s', (_title, folder, expected) => {
    expect(pathSourceProblem(doubleDeps(identities), folder, guard)).toBe(expected);
  });

  it('refuses when a folder below the candidate cannot be identified', () => {
    const deps = doubleDeps(identities);
    const unreadable = {
      ...deps,
      ports: {
        ...deps.ports,
        probe: {
          ...deps.ports.probe,
          identity: (target: string) =>
            target.startsWith('/System/Volumes/Data/') && target.endsWith('.agent-config')
              ? ({ kind: 'unknown' } as const)
              : deps.ports.probe.identity(target),
        },
      },
    };
    expect(pathSourceProblem(unreadable, '/System/Volumes/Data', guard)).toBe(
      'it holds the agent home, reached by another path',
    );
  });
});

describe('what the reader tolerated is printed (CM-1, MG-43)', () => {
  const load = (changes: readonly (readonly [string, string])[]) => {
    put('src/w/component.yaml', manifest(changes).replace('name: comp', 'name: w'));
    put('src/w/index.md', '# w\n');
    return api.readComponent({ name: 'w', root: path.join(temp, 'src/w'), slots: slots(), source: { kind: 'clone' } });
  };

  it.each([
    [
      'an unknown top-level key',
      [['routes:', 'surprise: 1\nroutes:']] as const,
      'warning: component w: component.yaml: surprise is not a key of this contract and is ignored',
    ],
  ])('%s loads and prints a warning', (_title, changes) => {
    const read = load(changes);
    expect(read.kind).toBe('loaded');
    if (read.kind === 'loaded') {
      expect(read.warnings.length).toBeGreaterThan(0);
      const line = renderComponentWarning('w', read.warnings[0]!);
      expect(line).toMatch(/^warning: component w: component\.yaml: surprise /);
      expect(line).not.toContain('\n');
    }
  });

  it('prints nothing for a manifest with only known keys', () => {
    const read = load([]);
    expect(read.kind === 'loaded' && read.warnings).toEqual([]);
  });
});

describe('printing', () => {
  it('shows control characters of a hostile component name and hides credentials in a reason', () => {
    const line = renderSkipWarning({
      name: 'a\u001b[31mb',
      reason: { kind: 'invalid', sentence: 'x https://u:p@h.invalid/r y' },
    });
    expect(line).not.toContain('\u001b');
    expect(line).toContain('\\x1b');
    expect(line).not.toContain('u:p@');
  });
});
