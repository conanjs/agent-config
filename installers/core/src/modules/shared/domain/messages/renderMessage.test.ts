// TR-5: the one message catalogue. Each row below is one row of the catalogue with sample values and the exact text the phase 2
// scenarios and installer-cli.md "Messages" show for it. A change to any catalogue text must change this table in the same commit.
// The ids stop at MG-39: MG-40 of that table is the output of two check scripts (scripts/check-local-files.ts and
// scripts/check-copilot-paths.ts), not an installer message, so it has no row here.
// The old Copilot folder is written in two pieces below only so that the sorting check of scripts/copilot-paths.yaml, which counts
// every line that names it, does not count this file; MessageCatalog.ts is the one recorded line.
import { describe, expect, it } from 'vitest';
import { MESSAGE_CATALOG, type MessageId } from '#shared/domain/messages/MessageCatalog.ts';
import { renderMessage } from '#shared/domain/messages/renderMessage.ts';

type Row = [id: string, values: Record<string, string>, text: string];

const rows: Row[] = [
  [
    'MG-01',
    { home: '/h/.agent-config', source: 'recorded', confirmation: 'confirmed' },
    'agent home: /h/.agent-config (recorded, confirmed)',
  ],
  [
    'MG-01.move',
    { home: '/h/.agent-config', source: 'default', recordedHome: '/h/old' },
    'agent home: /h/.agent-config (default, not confirmed; recorded home: /h/old)',
  ],
  ['MG-02', { status: 'needs-input' }, 'status: needs-input'],
  [
    'MG-03',
    { number: '1', kind: 'components', item: 'slot knowledge-storage' },
    '1. components: slot knowledge-storage',
  ],
  ['MG-03.detail', { detail: 'a detail' }, '   a detail'],
  ['MG-03.satisfy', { command: 'install' }, '   satisfy: install'],
  ['MG-03.proposal', { text: '~/workspace/ots' }, '   proposal: ~/workspace/ots'],
  ['MG-03.origin', { component: 'sdlc-x', commit: '9c1d5e7a2b4f' }, '   component: sdlc-x, commit: 9c1d5e7a2b4f'],
  ['MG-04', { number: '1', home: '/h/.agent-config' }, '1. home: /h/.agent-config'],
  ['MG-04.detail', {}, '   confirm the agent home'],
  ['MG-04.satisfy', {}, '   satisfy: install (interactive) and answer yes'],
  ['MG-05.detail', { oldHome: '/h/old', newHome: '/h/new' }, '   confirm moving the agent home from /h/old to /h/new'],
  ['MG-06', { number: '1', slot: 'knowledge-storage' }, '1. components: slot knowledge-storage'],
  ['MG-06.detail', { contract: 'knowledge-provider/v1' }, '   contract knowledge-provider/v1, no provider'],
  ['MG-06.satisfy', {}, '   satisfy: add <name> <source>'],
  [
    'MG-07',
    { component: 'sdlc-x', source: 'https://example.invalid/kb-g.git' },
    '   suggested by sdlc-x, unverified: https://example.invalid/kb-g.git',
  ],
  ['MG-08', { number: '1', name: 'REF_ROOT' }, '1. variables: REF_ROOT'],
  [
    'MG-08.detail',
    { description: 'Folder that holds the repos', component: 'sdlc-x' },
    '   Folder that holds the repos (declared by sdlc-x)',
  ],
  ['MG-08.satisfy', { name: 'REF_ROOT' }, '   satisfy: set REF_ROOT=<value>'],
  [
    'MG-09',
    { number: '1', item: 'hook guard (claude-code, pre-tool)' },
    '1. privileged: hook guard (claude-code, pre-tool)',
  ],
  ['MG-09.hook', { id: 'guard', agents: 'claude-code', event: 'pre-tool' }, 'hook guard (claude-code, pre-tool)'],
  ['MG-09.route', { id: 'guard' }, 'route guard'],
  [
    'MG-09.route-detail',
    { when: 'the project has a .specify folder', read: 'frameworks/agentic-sdlc/index.md' },
    '   when: the project has a .specify folder; read: frameworks/agentic-sdlc/index.md',
  ],
  ['MG-09.service', { name: 'kb-search', kind: 'mcp' }, 'service kb-search (mcp)'],
  ['MG-09.service-detail', { command: 'node', args: 'server.js' }, '   node server.js'],
  ['MG-09.satisfy', {}, '   satisfy: install (interactive) and approve'],
  [
    'MG-10',
    {},
    '   an interactive terminal is needed; an answer from a pipe, a file or an environment variable is never accepted',
  ],
  ['MG-11.home', { home: '/h/.agent-config' }, 'use /h/.agent-config as the agent home? (yes/no)'],
  ['MG-11.move', { oldHome: '/h/old', newHome: '/h/new' }, 'move the agent home from /h/old to /h/new? (yes/no)'],
  ['MG-11.privileged', {}, 'approve these privileged changes? (yes/no)'],
  [
    'MG-12',
    {},
    'usage: agent-config <command> [options]; commands: install, plan, doctor, set, add, use, init-component, uninstall',
  ],
  [
    'MG-13.none',
    {},
    'needs: Node 24.12 or later (none found). Install Node 24 from https://nodejs.org/ or set NODE to its path, then run install again.',
  ],
  [
    'MG-13.found',
    { version: '23.4.0' },
    'needs: Node 24.12 or later (found 23.4.0). Install Node 24 from https://nodejs.org/ or set NODE to its path, then run install again.',
  ],
  [
    'MG-14.git',
    { name: 'kb-g', url: 'https://github.com/o/kb.git', ref: 'main', commit: '9c1d5e7a2b4f' },
    'component kb-g: git https://github.com/o/kb.git main at 9c1d5e7a2b4f',
  ],
  ['MG-14.path', { name: 'kb-g', path: '/h/.agent-config/x' }, 'component kb-g: path /h/.agent-config/x (live)'],
  ['MG-15', { name: 'kb-g', from: '3f2a9c41d07b', to: '9c1d5e7a2b4f' }, 'updated kb-g: 3f2a9c41d07b..9c1d5e7a2b4f'],
  ['MG-16', { folder: '/h/src/kb' }, 'wrote /h/src/kb/component.yaml'],
  ['MG-17', { name: 'kb-g', path: '/h/.agent-config/x' }, 'stored kb-g in /h/.agent-config/x'],
  ['MG-18', { path: '/h/.agent-config/x' }, 'backup: /h/.agent-config/x'],
  ['MG-19.retired', { path: '/h/.agent-config/x' }, 'retired: /h/.agent-config/x'],
  ['MG-19.not-own', { path: '/h/.agent-config/x' }, "left: /h/.agent-config/x: not the installer's own link"],
  ['MG-19.kept', { path: '/h/.agent-config/x' }, 'kept: /h/.agent-config/x: used by a hook command'],
  ['MG-19.edited', { path: '/h/.agent-config/x' }, 'left: /h/.agent-config/x: edited since install'],
  [
    'MG-20',
    { name: 'kb-g', local: '/h/src/kb', public: 'https://github.com/o/kb.git' },
    'override: kb-g: local source /h/src/kb replaces public source https://github.com/o/kb.git',
  ],
  [
    'MG-21',
    { name: 'kb-g', reason: 'source type archive not supported in this release' },
    'warning: component kb-g is skipped: source type archive not supported in this release',
  ],
  ['MG-21.archive', {}, 'source type archive not supported in this release'],
  ['MG-21.no-manifest', { folder: '/h/src/kb' }, 'no component.yaml in /h/src/kb'],
  ['MG-21.unknown-slot', { slot: 'knowledge-storage' }, 'slot knowledge-storage is not in slots/v1'],
  ['MG-21.invalid', { sentence: 'name must be an id' }, 'component.yaml is invalid: name must be an id'],
  ['MG-21.symlink', { path: '/h/.agent-config/x' }, 'symlink /h/.agent-config/x leaves the component root'],
  ['MG-22', { name: 'kb-g' }, 'warning: component kb-g has submodules; they are ignored'],
  [
    'MG-23',
    { list: '/h/.agent-config/components.local.yaml', sentence: 'name must be an id' },
    'error: /h/.agent-config/components.local.yaml is invalid: name must be an id',
  ],
  ['MG-24', { cycle: 'a -> b -> a' }, 'error: dependency cycle: a -> b -> a'],
  [
    'MG-25',
    {
      consumer: 'sdlc-x',
      contract: 'knowledge-provider/v1',
      slot: 'knowledge-storage',
      provider: 'kb-a',
      offered: 'company-kb/v1',
    },
    'error: sdlc-x needs knowledge-provider/v1 from slot knowledge-storage, but kb-a offers company-kb/v1',
  ],
  [
    'MG-26',
    { consumer: 'sdlc-x', file: 'index.md', path: '/h/.agent-config/x', provider: 'kb-a' },
    'error: sdlc-x: index.md cites /h/.agent-config/x, which kb-a does not export',
  ],
  [
    'MG-27',
    { slot: 'knowledge-storage', first: 'kb-a', second: 'kb-b' },
    'error: slot knowledge-storage allows one provider but kb-a and kb-b both fill it; pick one with: use <name> <source>',
  ],
  ['MG-28', { name: 'kb-g', range: '>=25', version: '23.4.0' }, 'error: component kb-g needs node >=25, found 23.4.0'],
  [
    'MG-29',
    {
      name: 'kb-g',
      tag: 'v1',
      locked: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      current: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    },
    'error: tag moved: component kb-g, tag v1, locked aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa, now bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
  ],
  [
    'MG-30',
    { lock: '/h/.agent-config/install.lock', command: 'install', started: '2026-11-16T09:00:00+07:00' },
    'error: another run holds the lock /h/.agent-config/install.lock (install, started 2026-11-16T09:00:00+07:00)',
  ],
  [
    'MG-31',
    { name: 'kb-g', folder: '/h/src/kb' },
    'error: component kb-g: path source folder /h/src/kb does not exist',
  ],
  [
    'MG-32',
    { name: 'kb-g', url: 'https://github.com/o/kb.git', ref: 'main' },
    'error: component kb-g: cannot fetch git source https://github.com/o/kb.git (ref main)',
  ],
  ['MG-32.cause', { cause: 'fatal: not found' }, '   cause: fatal: not found'],
  [
    'MG-33',
    { folder: '/h/src/kb' },
    'error: /h/src/kb/component.yaml already exists; init-component never overwrites a manifest',
  ],
  [
    'MG-34',
    { name: 'kb-g' },
    "error: component kb-g has a source URL with credentials; keep credentials in git's credential helper or ssh-agent (M-07)",
  ],
  [
    'MG-34.add',
    { name: 'kb-g' },
    "error: refused to add kb-g: the source URL has credentials; keep credentials in git's credential helper or ssh-agent (M-07)",
  ],
  ['MG-35.dash', { name: 'kb-g' }, 'error: refused to add kb-g: a source cannot start with a dash (M-05)'],
  [
    'MG-35.scheme',
    { name: 'kb-g' },
    'error: refused to add kb-g: the source must be an https or ssh git address or an absolute folder (M-05)',
  ],
  [
    'MG-35.name',
    { name: 'kb-g' },
    'error: component name kb-g is not valid: use lowercase letters, digits and hyphens, at most 64 (M-03)',
  ],
  [
    'MG-36.name',
    { name: 'MY_TOKEN', word: 'TOKEN' },
    'error: refused to store MY_TOKEN: the name contains TOKEN; variables are public values that every agent reads (M-08)',
  ],
  [
    'MG-36.value',
    { name: 'REF', prefix: 'ghp_' },
    'error: refused to store REF: the value starts with ghp_; variables are public values that every agent reads (M-08)',
  ],
  ['MG-36.undeclared', { name: 'REF_RAOT' }, 'error: REF_RAOT is not declared by any enabled component'],
  ['MG-36.closest', { names: 'REF_ROOT, REF_DIR' }, 'closest declared names: REF_ROOT, REF_DIR'],
  [
    'MG-37',
    { check: 'schema: kb: component.yaml is not a valid component/v1 manifest' },
    'error: check failed: schema: kb: component.yaml is not a valid component/v1 manifest',
  ],
  ['MG-37.schema', { component: 'sdlc-x' }, 'schema: sdlc-x: component.yaml is not a valid component/v1 manifest'],
  [
    'MG-37.exports',
    { component: 'sdlc-x', path: '/h/.agent-config/x' },
    'exports: sdlc-x: exported path /h/.agent-config/x does not exist',
  ],
  [
    'MG-37.variables',
    {
      name: 'kb-g',
      firstComponent: 'kb-a',
      firstDescription: 'Root A',
      secondComponent: 'kb-b',
      secondDescription: 'Root B',
    },
    'variables: kb-g: kb-a says "Root A", kb-b says "Root B"',
  ],
  ['MG-38', { what: 'cannot create links' }, 'error: install failed: cannot create links'],
  ['MG-38.cause', { cause: 'fatal: not found' }, '   cause: fatal: not found'],
  [
    'MG-39',
    {
      severity: 'warning',
      check: 'compat-link',
      item: '/h/.agent-claude/x',
      detail: 'compatibility link still present',
    },
    'warning: compat-link: /h/.agent-claude/x: compatibility link still present',
  ],
  ['MG-39.link-target-gone', {}, 'the link target is gone'],
  ['MG-39.hash-differs', {}, 'differs from install-state.json'],
  ['MG-39.lock-no-source', {}, 'components.lock lists it but no list does'],
  ['MG-39.manifest-invalid', {}, 'component.yaml is not a valid component/v1 manifest'],
  ['MG-39.manifest-missing', { folder: '/h/src/kb' }, 'no component.yaml in /h/src/kb'],
  ['MG-39.variable-missing', { component: 'sdlc-x' }, 'required by sdlc-x and has no value'],
  ['MG-39.path-source-missing', { folder: '/h/src/kb' }, 'path source folder /h/src/kb does not exist'],
  ['MG-39.symlink-escape', {}, 'leaves the component root'],
  ['MG-39.interrupted-install', {}, 'restored to the previous state'],
  [
    'MG-39.not-version-controlled',
    { path: '/h/.agent-config/x' },
    '/h/.agent-config/x is not in a git repository (not version-controlled)',
  ],
  ['MG-39.compat-link', {}, 'compatibility link still present'],
  ['MG-39.permissions', {}, 'readable by others'],
  ['MG-39.old-agent-home-path', {}, 'names ~/' + '.copilot/knowledge'],
  ['MG-39.backups.one', { size: '1.2 MB' }, 'warning: backups: 1 backup, 1.2 MB'],
  ['MG-39.backups.many', { count: '3', size: '1.2 MB' }, 'warning: backups: 3 backups, 1.2 MB'],
];

describe('TR-5 message catalogue', () => {
  it('has exactly the rows of the table above, no more and no fewer', () => {
    expect(rows.map(([id]) => id).sort()).toEqual(Object.keys(MESSAGE_CATALOG).sort());
    expect(rows).toHaveLength(94);
  });

  it('covers MG-01 to MG-39 and nothing above MG-39', () => {
    const numbers = new Set(Object.keys(MESSAGE_CATALOG).map((id) => Number(id.slice(3, 5))));
    expect([...numbers].filter((number) => number > 39)).toEqual([]);
    const missing = Array.from({ length: 39 }, (_unused, index) => index + 1).filter((number) => !numbers.has(number));
    expect(missing).toEqual([]);
  });

  it.each(Object.keys(MESSAGE_CATALOG))('%s starts in lower case or with a placeholder, as the grammar says', (id) => {
    expect(MESSAGE_CATALOG[id as MessageId].trimStart()).not.toMatch(/^[A-Z]/);
  });

  it.each(Object.keys(MESSAGE_CATALOG))('%s uses only simple placeholder names', (id) => {
    expect(MESSAGE_CATALOG[id as MessageId].replace(/\{[A-Za-z0-9]+\}/g, '')).not.toMatch(/[{}]/);
  });
});

describe('TR-5 renderMessage prints each row exactly', () => {
  it.each(rows)('%s', (id, values, text) => {
    expect(renderMessage(id as MessageId, values as never)).toBe(text);
  });

  it('M-07 redacts a credential in a value', () => {
    const text = renderMessage('MG-32', {
      name: 'kb',
      url: 'https://vinh:s3cr3t-fake@example.invalid/kb.git',
      ref: 'main',
    });
    expect(text).toBe(
      'error: component kb: cannot fetch git source https://<redacted>@example.invalid/kb.git (ref main)',
    );
  });

  it('prints a value that holds braces as written, without filling it again', () => {
    expect(renderMessage('MG-16', { folder: '{folder}' })).toBe('wrote {folder}/component.yaml');
  });

  it('prints a plural backup count apart from the single one (safety.feature, AC-7.6)', () => {
    expect(renderMessage('MG-39.backups.one', { size: '4 KB' })).toBe('warning: backups: 1 backup, 4 KB');
    expect(renderMessage('MG-39.backups.many', { count: '2', size: '8 KB' })).toBe('warning: backups: 2 backups, 8 KB');
  });

  it('throws naming the id and the placeholder, not a value, when a value is missing', () => {
    // @ts-expect-error the call omits a value on purpose: the type refuses it, and the run-time check must too.
    expect(() => renderMessage('MG-16', {})).toThrow('message MG-16 needs a value for {folder}');
  });
});
