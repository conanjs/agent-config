// The pure rules of the manifests module, as tables: decoding the contract examples, the credential finding, sentences, policy and slots.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { decodeComponent } from '#manifests/domain/decode/decodeComponent.ts';
import { decodeList } from '#manifests/domain/decode/decodeList.ts';
import { decodeSlots } from '#manifests/domain/decode/decodeSlots.ts';
import { isProtocolAllowed } from '#manifests/domain/rules/GitPolicy.ts';
import { findingsSentence, findingSentence } from '#manifests/domain/rules/findingSentences.ts';
import { checkListEntries, listIssuesOf, mergeLists } from '#manifests/domain/rules/listRules.ts';
import {
  checkAgainstSlot,
  ownFolderPaths,
  pointsIntoGitFolder,
  slotTableProblems,
} from '#manifests/domain/rules/slotRules.ts';
import { parseContractFile, type ContractParse } from '#shared/domain/name/NameRules.ts';

const repoRoot = path.resolve(import.meta.dirname, '../../../../../../..');
const example = (relative: string): string => fs.readFileSync(path.join(repoRoot, relative), 'utf8');
const valid = (id: string, relative: string): Record<string, unknown> => {
  const parsed = parseContractFile(id, example(relative));
  if (!parsed.ok) throw new Error(`${relative} must be valid`);
  return parsed.value;
};

describe('decoding the contract examples', () => {
  it('reads the agentic-sdlc component example completely', () => {
    const manifest = decodeComponent(valid('component/v1', 'contracts/component/v1/examples/valid/component.yaml'));
    expect(manifest).toMatchObject({ name: 'agentic-sdlc', slot: 'framework', scope: 'per-project', contractsPin: 1 });
    expect(manifest.depends.slots.map((dependency) => dependency.slot)).toEqual([
      'knowledge-storage',
      'core',
      'company-knowledge-storage',
    ]);
    expect(manifest.depends.slots[0]?.suggest).toEqual({
      type: 'git',
      url: 'https://github.com/conanjs/agent-knowledge.git',
      ref: 'main',
    });
    expect(manifest.depends.runtime).toEqual({ node: '>=24.12' });
    expect(manifest.variables.map((variable) => variable.detect?.kind)).toEqual(['dir-exists', 'env']);
    expect(manifest.idleCost['claude-code']).toBe(3500);
  });

  it('reads the core component example with a service and a hook', () => {
    const manifest = decodeComponent(
      valid('component/v1', 'contracts/component/v1/examples/valid/core-component.yaml'),
    );
    expect(manifest.slot).toBe('core');
    expect(manifest.provides.services.length).toBeGreaterThan(0);
    expect(manifest.hooks.length).toBeGreaterThan(0);
  });

  it('reads the slots and the lists', () => {
    const table = decodeSlots(valid('slots/v1', 'contracts/slots.yaml'));
    expect(table.slots[1]).toMatchObject({
      name: 'knowledge-storage',
      selfContained: true,
      contracts: ['knowledge-provider/v1'],
    });
    expect(table.slots[2]?.contracts).toEqual(['company-kb/v1', 'knowledge-provider/v1']);
    expect(slotTableProblems(table)).toEqual([]);
    const local = decodeList(
      valid('components-list/v1', 'contracts/components-list/v1/examples/valid/components.local.yaml'),
    );
    expect(local.local).toBe(true);
    expect(local.entries.map((entry) => entry.source.type)).toContain('archive');
  });

  it('does not copy unknown keys, including a prototype key', () => {
    const parsed = parseContractFile(
      'component/v1',
      `${example('contracts/component/v1/examples/valid/component.yaml')}\n__proto__: { polluted: 1 }\nextra: x\n`,
    );
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      const manifest = decodeComponent(parsed.value);
      expect(Object.keys(manifest)).not.toContain('extra');
      expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
    }
  });
});

describe('M-07 the credential finding of the reader is what listIssuesOf looks for', () => {
  const read = (url: string): Extract<ContractParse, { ok: false }> => {
    const parsed = parseContractFile(
      'components-list/v1',
      `schema: components-list/v1\nlocal: true\ncomponents:\n  - { name: kb, source: { type: git, url: '${url}', ref: main } }\n`,
    );
    if (parsed.ok) throw new Error('expected a refusal');
    return parsed;
  };
  it.each([
    ['https://u:p@e.invalid/k.git', [{ kind: 'credentials', component: 'kb' }]],
    ['https://u@e.invalid/k.git', [{ kind: 'credentials', component: 'kb' }]],
    ['http://e.invalid/k.git', [{ kind: 'invalid' }]],
  ])('%s', (url, expected) => {
    expect(listIssuesOf(read(url))).toMatchObject(expected);
  });
});

describe('sentences and policy', () => {
  it('names the field, and no field for the whole file', () => {
    expect(findingSentence({ field: 'a.b', message: 'is wrong' })).toBe('a.b is wrong');
    expect(findingSentence({ field: '(document)', message: 'a tag is not allowed' })).toBe('a tag is not allowed');
  });
  it('shows three findings and counts the rest', () => {
    const findings = ['a', 'b', 'c', 'd', 'e'].map((field) => ({ field, message: 'x' }));
    expect(findingsSentence(findings)).toBe('a x; b x; c x; 2 more not shown');
  });
  it.each([
    [['https', 'ssh'], 'https://e.invalid/x.git', true],
    [['https', 'ssh'], 'ssh://git@e.invalid/x.git', true],
    [['https', 'ssh'], 'file:///tmp/x', false],
    [['https', 'ssh'], 'ext::sh -c x', false],
    [['https', 'ssh'], 'HTTPS://e.invalid/x', true],
    [['ssh'], 'https://e.invalid/x.git', false],
    [[], 'https://e.invalid/x.git', false],
  ] as const)('policy %j for %s is %s', (allowedProtocols, url, allowed) => {
    expect(isProtocolAllowed({ allowedProtocols }, url)).toBe(allowed);
  });
});

describe('lists and slots', () => {
  const entry = (name: string, source: object) => ({ name, source }) as never;
  const policy = { allowedProtocols: ['https', 'ssh'] } as const;
  const sentences = (
    list: Parameters<typeof checkListEntries>[0],
    local: boolean,
    flavor: 'posix' | 'win32',
  ): string[] =>
    checkListEntries(list, local, policy, flavor).map((issue) => (issue.kind === 'invalid' ? issue.sentence : ''));
  const listOf = (local: boolean, ...entries: object[]) => ({ local, present: true, entries }) as never;

  it.each([
    ['the public flag in the local file', true, listOf(false), 'posix', ['local must be true in the local list']],
    ['the local flag in the public file', false, listOf(true), 'posix', ['local must be false in the public list']],
    [
      'a relative path source',
      true,
      listOf(true, entry('a', { type: 'path', path: 'rel' })),
      'posix',
      ['components[0].source.path must be an absolute folder'],
    ],
    [
      'the same name twice',
      true,
      listOf(true, entry('a', { type: 'path', path: '/x' }), entry('a', { type: 'path', path: '/y' })),
      'posix',
      ['components[1].name appears twice in this list'],
    ],
    [
      'a Windows drive path on Windows',
      true,
      listOf(true, entry('w', { type: 'path', path: 'C:\\work\\w' })),
      'win32',
      [],
    ],
    [
      'a Windows drive path on posix',
      true,
      listOf(true, entry('w', { type: 'path', path: 'C:\\work\\w' })),
      'posix',
      ['components[0].source.path must be an absolute folder'],
    ],
    ['a posix path on Windows', true, listOf(true, entry('p', { type: 'path', path: '/posix' })), 'win32', []],
    [
      'a git address outside the policy',
      true,
      listOf(true, entry('g', { type: 'git', url: 'file:///x', ref: 'main' })),
      'posix',
      ['components[0].source.url must start with https:// or ssh:// (M-05)'],
    ],
    [
      'a good local list',
      true,
      listOf(true, entry('g', { type: 'git', url: 'ssh://git@e.invalid/x.git', ref: 'm' })),
      'posix',
      [],
    ],
  ] as const)('checks %s', (_title, expectLocal, list, flavor, expected) => {
    expect(sentences(list, expectLocal, flavor)).toEqual(expected);
  });

  it.each([
    ['a public entry stays public', 'a', 'public', '-'],
    ['a local entry wins over its public one and remembers it', 'b', 'local', 'r'],
    ['a local-only entry is appended', 'c', 'local', '-'],
  ])('merges: %s', (_title, name, origin, replaced) => {
    const merged = mergeLists(
      listOf(false, entry('a', { type: 'path', path: '/1' }), entry('b', { type: 'path', path: '/2' })),
      listOf(true, entry('c', { type: 'path', path: '/3' }), entry('b', { type: 'path', path: '/4' })),
    );
    const found = merged.find((each) => each.name === name);
    expect([found?.origin, found?.replaced === undefined ? '-' : 'r']).toEqual([origin, replaced]);
  });

  it('keeps the public order and appends the local-only entries last', () => {
    const merged = mergeLists(
      listOf(false, entry('a', { type: 'path', path: '/1' }), entry('b', { type: 'path', path: '/2' })),
      listOf(true, entry('c', { type: 'path', path: '/3' }), entry('b', { type: 'path', path: '/4' })),
    );
    expect(merged.map((each) => each.name)).toEqual(['a', 'b', 'c']);
  });

  it('lists the fields that point into the component folder only', () => {
    const manifest = decodeComponent(valid('component/v1', 'contracts/component/v1/examples/valid/component.yaml'));
    expect(ownFolderPaths(manifest).map(([field]) => field)).toEqual([
      'locations.framework',
      'provides.index',
      'provides.skills',
      'provides.agents',
    ]);
  });

  describe('a manifest against its slot', () => {
    const table = decodeSlots(valid('slots/v1', 'contracts/slots.yaml'));
    const manifest = decodeComponent(valid('component/v1', 'contracts/component/v1/examples/valid/component.yaml'));
    it.each([
      ['fits its slot', manifest, 'list', undefined],
      ['names the reserved core slot from a list', { ...manifest, slot: 'core' }, 'list', { kind: 'invalid' }],
      ['names a slot that does not exist', { ...manifest, slot: 'zzz' }, 'list', { kind: 'unknown-slot', slot: 'zzz' }],
      ['leaves out a required location', { ...manifest, locations: {} }, 'list', { kind: 'invalid' }],
      [
        'names a location the slot lacks',
        { ...manifest, locations: { framework: '.', extra: '.' } },
        'list',
        { kind: 'invalid' },
      ],
    ] as const)('%s', (_title, subject, origin, expected) => {
      const result = checkAgainstSlot(subject, table, origin);
      if (expected === undefined) expect(result).toBeUndefined();
      else expect(result).toMatchObject(expected);
    });
  });

  it.each([
    ['.git', '/r', '/r/.git', true],
    ['.GIT', '/r', '/r/.GIT', true],
    ['./.Git', '/r', '/r/.Git', true],
    ['alias', '/r', '/r/.git/sub', true],
    ['alias', '/r', '/r/.GIT', true],
    ['.github', '/r', '/r/.github', false],
    ['docs/.git', '/r', '/r/docs/.git', false],
    ['.', '/r', '/r', false],
  ])('git folder test for %s (canonical %s) is %s', (written, root, real, expected) => {
    expect(pointsIntoGitFolder(written, root, real, 'posix')).toBe(expected);
  });
});
