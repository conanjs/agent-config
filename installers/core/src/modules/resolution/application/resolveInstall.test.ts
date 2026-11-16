// T134: the resolver as tables, one row per scenario of tests/installer-resolution/resolve.feature (AC-5.1 to AC-5.9, SC-008) and per
// edge the scenarios cannot reach (long chains, two cycles, majors N, N-1 and N-2, credentials in a suggested source).
import { describe, expect, it } from 'vitest';
import type { ComponentManifest } from '#manifests/application/ManifestTypes.ts';
import { renderResolutionError, toReportNeeds } from '#resolution/application/messages/renderResolutionMessages.ts';
import { resolveInstall } from '#resolution/application/resolveInstall.ts';
import type { Candidate, CitedPath, ResolveInput } from '#resolution/application/ResolutionTypes.ts';

const slots = {
  slots: [
    { name: 'core', reserved: true, multiple: false, contracts: ['component/v1'] },
    { name: 'knowledge-storage', reserved: false, multiple: false, contracts: ['knowledge-provider/v1'] },
    {
      name: 'company-knowledge-storage',
      reserved: false,
      multiple: true,
      contracts: ['company-kb/v1', 'knowledge-provider/v1'],
    },
    { name: 'framework', reserved: false, multiple: true, contracts: ['framework/v1'] },
  ],
};

interface Spec {
  slot: string;
  offers?: string[];
  exports?: string[];
  needs?: { slot: string; contract: string; required?: boolean; suggest?: string }[];
  runtime?: Record<string, string>;
  origin?: 'public' | 'local';
}

function manifest(name: string, spec: Spec): ComponentManifest {
  return {
    name,
    version: '1.0.0',
    slot: spec.slot,
    repository: undefined,
    scope: undefined,
    contractsPin: 1,
    locations: {},
    provides: {
      contracts: spec.offers ?? [],
      index: undefined,
      exports: spec.exports ?? [],
      skills: undefined,
      agents: undefined,
      services: [],
    },
    depends: {
      slots: (spec.needs ?? []).map((need) => ({
        slot: need.slot,
        contract: need.contract,
        required: need.required ?? true,
        docs: [],
        suggest: need.suggest === undefined ? undefined : { type: 'git', url: need.suggest, ref: 'main' },
      })),
      runtime: spec.runtime ?? {},
    },
    routes: [],
    hooks: [],
    variables: [],
    idleCost: {},
  };
}

const candidate = (name: string, spec: Spec): Candidate => ({
  name,
  origin: spec.origin ?? 'local',
  source: { type: 'path', path: `/src/${name}` },
  manifest: manifest(name, spec),
});

const kb = (name: string, extra: Partial<Spec> = {}): Candidate =>
  candidate(name, {
    slot: 'knowledge-storage',
    offers: ['knowledge-provider/v1'],
    exports: ['knowledge/a/b.md'],
    ...extra,
  });
const sdlc = (name: string, extra: Partial<Spec> = {}): Candidate =>
  candidate(name, {
    slot: 'framework',
    offers: ['framework/v1'],
    needs: [{ slot: 'knowledge-storage', contract: 'knowledge-provider/v1' }],
    ...extra,
  });

const input = (candidates: Candidate[], extra: Partial<ResolveInput> = {}): ResolveInput => ({
  slots,
  candidates,
  core: undefined,
  citations: [],
  runtime: { node: '24.12.0' },
  ...extra,
});

const names = (result: ReturnType<typeof resolveInstall>): string[] => result.install.map((each) => each.name);
const lines = (result: ReturnType<typeof resolveInstall>): string[] => result.errors.map(renderResolutionError);

describe('AC-5.1 to AC-5.3 where a provider comes from', () => {
  it.each([
    ['AC-5.1 a filled slot is reused', [kb('kb-g'), sdlc('sdlc-x')], ['kb-g', 'sdlc-x']],
    [
      'AC-5.2 an empty slot is filled by the public default',
      [kb('kb-a', { origin: 'public' }), sdlc('sdlc-x')],
      ['kb-a', 'sdlc-x'],
    ],
    ['a consumer listed before its provider still comes after it', [sdlc('sdlc-x'), kb('kb-a')], ['kb-a', 'sdlc-x']],
    ['SC-008 swapping the provider leaves the consumer in the plan', [kb('kb-b'), sdlc('sdlc-x')], ['kb-b', 'sdlc-x']],
    [
      'AC-5.7 a slot that takes many keeps both',
      [kb('kb-a'), sdlc('sdlc-y'), sdlc('sdlc-x')],
      ['kb-a', 'sdlc-x', 'sdlc-y'],
    ],
  ])('%s', (_title, candidates, expected) => {
    const result = resolveInstall(input(candidates));
    expect(result.status).toBe('resolved');
    expect(names(result)).toEqual(expected);
  });

  it('a local provider replaces a public default of a one-provider slot, which is reported and not installed', () => {
    const result = resolveInstall(input([kb('kb-a', { origin: 'public' }), kb('kb-b'), sdlc('sdlc-x')]));
    expect(names(result)).toEqual(['kb-b', 'sdlc-x']);
    expect(result.displaced).toEqual(['kb-a']);
  });

  it('AC-5.3 a chain consumer, A, B installs B first', () => {
    const co = candidate('co-kb', {
      slot: 'company-knowledge-storage',
      offers: ['company-kb/v1'],
      needs: [{ slot: 'knowledge-storage', contract: 'knowledge-provider/v1' }],
    });
    const z = sdlc('sdlc-z', { needs: [{ slot: 'company-knowledge-storage', contract: 'company-kb/v1' }] });
    const result = resolveInstall(input([z, co, kb('kb-a')]));
    expect(names(result)).toEqual(['kb-a', 'co-kb', 'sdlc-z']);
  });

  it('AC-5.3 when B is missing the need names B only and nothing is installed', () => {
    const co = candidate('co-kb', {
      slot: 'company-knowledge-storage',
      offers: ['company-kb/v1'],
      needs: [{ slot: 'knowledge-storage', contract: 'knowledge-provider/v1' }],
    });
    const result = resolveInstall(input([co]));
    expect(result.status).toBe('needs');
    expect(result.install).toEqual([]);
    expect(result.needs).toEqual([
      { slot: 'knowledge-storage', contract: 'knowledge-provider/v1', requiredBy: ['co-kb'], suggested: [] },
    ]);
    expect(toReportNeeds(result.needs)).toEqual([
      {
        kind: 'components',
        item: 'slot knowledge-storage',
        detail: 'contract knowledge-provider/v1, no provider',
        satisfy: 'add <name> <source>',
      },
    ]);
  });

  it('resolves a chain of 300 components in dependency order', () => {
    const chain = Array.from({ length: 300 }, (_v, n) => {
      const name = `c${String(n).padStart(3, '0')}`;
      return candidate(name, {
        slot: 'framework',
        offers: [`link-${n}/v1`],
        needs: n === 0 ? [] : [{ slot: 'framework', contract: `link-${n - 1}/v1` }],
      });
    }).reverse();
    const result = resolveInstall(input(chain));
    expect(result.status).toBe('resolved');
    expect(names(result)[0]).toBe('c000');
    expect(names(result)[299]).toBe('c299');
  });

  it('the answer does not depend on the order the candidates arrive in', () => {
    const set = [kb('kb-a'), sdlc('sdlc-x'), sdlc('sdlc-y'), kb('kb-b', { origin: 'public' })];
    const forward = resolveInstall(input(set));
    const backward = resolveInstall(input([...set].reverse()));
    expect(backward).toEqual(forward);
  });
});

describe('needs', () => {
  it.each([
    ['two consumers of one slot give one need naming both', [sdlc('b'), sdlc('a')], 1, ['a', 'b']],
    [
      'two contracts of one slot give two needs',
      [sdlc('a'), sdlc('b', { needs: [{ slot: 'knowledge-storage', contract: 'knowledge-provider/v2' }] })],
      2,
      ['a'],
    ],
  ])('%s', (_title, candidates, count, firstBy) => {
    const result = resolveInstall(input(candidates));
    expect(result.needs).toHaveLength(count);
    expect(result.needs[0]?.requiredBy).toEqual(firstBy.length === 2 ? firstBy : ['a']);
  });

  it('an optional dependency without a provider is a note, not a need', () => {
    const result = resolveInstall(
      input([
        sdlc('a', { needs: [{ slot: 'knowledge-storage', contract: 'knowledge-provider/v1', required: false }] }),
      ]),
    );
    expect(result.status).toBe('resolved');
    expect(result.optionalGaps).toEqual([
      { consumer: 'a', slot: 'knowledge-storage', contract: 'knowledge-provider/v1' },
    ]);
  });

  it('shows a suggested source as unverified data and never as a command', () => {
    const result = resolveInstall(
      input([
        sdlc('a', {
          needs: [
            { slot: 'knowledge-storage', contract: 'knowledge-provider/v1', suggest: 'https://example.invalid/kb.git' },
          ],
        }),
      ]),
    );
    expect(result.needs[0]?.suggested).toEqual([{ by: 'a', source: 'https://example.invalid/kb.git' }]);
    expect(toReportNeeds(result.needs)[0]).toMatchObject({
      satisfy: 'add <name> <source>',
      suggested: { by: 'a', verified: false, source: 'https://example.invalid/kb.git' },
    });
  });

  it.each([
    ['a token in the query', 'https://example.invalid/kb.git?token=SECRETQUERY'],
    ['user and password', 'https://vinh:s3cr3t-fake@example.invalid/kb.git'],
    ['a github token', 'https://example.invalid/ghp_abcdefghijklmnopqrstuvwxyz0123456789'],
  ])('refuses a suggested source with %s and never prints it', (_title, url) => {
    const result = resolveInstall(
      input([sdlc('a', { needs: [{ slot: 'knowledge-storage', contract: 'knowledge-provider/v1', suggest: url }] })]),
    );
    expect(result.status).toBe('failed');
    expect(result.errors).toEqual([{ kind: 'unsafe-suggestion', component: 'a' }]);
    expect(result.needs[0]?.suggested).toEqual([]);
    expect(JSON.stringify(result)).not.toMatch(/SECRETQUERY|s3cr3t|ghp_/);
    expect(lines(result)).toEqual(['error: component a: suggested source refused: it contains credential-like text']);
  });
});

describe('AC-5.4 cycles', () => {
  const framework = (name: string, needs: string): Candidate =>
    candidate(name, {
      slot: 'framework',
      offers: [`${name}/v1`],
      needs: [{ slot: 'framework', contract: `${needs}/v1` }],
    });

  it.each([
    [
      'two components',
      [framework('cyc-b', 'cyc-a'), framework('cyc-a', 'cyc-b')],
      ['error: dependency cycle: cyc-a -> cyc-b -> cyc-a'],
    ],
    [
      'three components, printed from the smallest name',
      [framework('c', 'b'), framework('b', 'a'), framework('a', 'c')],
      ['error: dependency cycle: a -> c -> b -> a'],
    ],
    ['a component that needs its own contract', [framework('a', 'a')], ['error: dependency cycle: a -> a']],
    [
      'two separate cycles, in order',
      [framework('y', 'x'), framework('x', 'y'), framework('b', 'a'), framework('a', 'b')],
      ['error: dependency cycle: a -> b -> a', 'error: dependency cycle: x -> y -> x'],
    ],
  ])('%s', (_title, candidates, expected) => {
    const result = resolveInstall(input(candidates));
    expect(result.status).toBe('failed');
    expect(lines(result)).toEqual(expected);
    expect(result.install).toEqual([]);
  });
});

describe('AC-5.5 contract majors', () => {
  it.each([
    ['a provider that offers the contract', ['knowledge-provider/v1'], 'knowledge-provider/v1', undefined],
    [
      'a provider that offers N and N-1 serves a consumer of N-1',
      ['knowledge-provider/v1', 'knowledge-provider/v2'],
      'knowledge-provider/v1',
      undefined,
    ],
    [
      'a provider that offers N and N-1 serves a consumer of N',
      ['knowledge-provider/v1', 'knowledge-provider/v2'],
      'knowledge-provider/v2',
      undefined,
    ],
    [
      'a provider of v2 only fails a consumer of v1',
      ['knowledge-provider/v2'],
      'knowledge-provider/v1',
      'knowledge-provider/v2',
    ],
    [
      'a provider of v1 only fails a consumer of v2',
      ['knowledge-provider/v1'],
      'knowledge-provider/v2',
      'knowledge-provider/v1',
    ],
    [
      'a provider two majors ahead fails (N-2)',
      ['knowledge-provider/v2', 'knowledge-provider/v3'],
      'knowledge-provider/v1',
      'knowledge-provider/v2, knowledge-provider/v3',
    ],
    [
      'a provider of another contract name shows all it offers',
      ['company-kb/v1'],
      'knowledge-provider/v1',
      'company-kb/v1',
    ],
    [
      'a provider offering two contracts serves either',
      ['company-kb/v1', 'knowledge-provider/v1'],
      'company-kb/v1',
      undefined,
    ],
  ])('%s', (_title, offers, wanted, shown) => {
    const result = resolveInstall(
      input([
        candidate('kb-p', { slot: 'knowledge-storage', offers }),
        sdlc('sdlc-x', { needs: [{ slot: 'knowledge-storage', contract: wanted }] }),
      ]),
    );
    if (shown === undefined) {
      expect(result.status).toBe('resolved');
    } else {
      expect(lines(result)).toEqual([
        `error: sdlc-x needs ${wanted} from slot knowledge-storage, but kb-p offers ${shown}`,
      ]);
    }
  });

  it('a provider that offers nothing says so', () => {
    const result = resolveInstall(input([candidate('kb-p', { slot: 'knowledge-storage' }), sdlc('sdlc-x')]));
    expect(lines(result)).toEqual([
      'error: sdlc-x needs knowledge-provider/v1 from slot knowledge-storage, but kb-p offers no contract',
    ]);
  });

  it('a slot of many providers is served when any one offers the contract', () => {
    const result = resolveInstall(
      input([
        candidate('co-a', { slot: 'company-knowledge-storage', offers: ['company-kb/v2'] }),
        candidate('co-b', { slot: 'company-knowledge-storage', offers: ['company-kb/v1'] }),
        sdlc('z', { needs: [{ slot: 'company-knowledge-storage', contract: 'company-kb/v1' }] }),
      ]),
    );
    expect(names(result)).toEqual(['co-a', 'co-b', 'z']);
  });
});

describe('AC-5.6 cited docs must be exported', () => {
  const cite = (locationPath: string, slot = 'knowledge-storage'): CitedPath => ({
    consumer: 'sdlc-x',
    file: 'docs/guide.md',
    slot,
    locationPath,
  });
  it.each([
    ['an exported path', [cite('knowledge/a/b.md')], []],
    [
      'a path the provider does not export',
      [cite('knowledge/a/c.md')],
      ['error: sdlc-x: docs/guide.md cites knowledge/a/c.md, which kb-a does not export'],
    ],
    [
      'two missing paths, in order',
      [cite('knowledge/z.md'), cite('knowledge/a/c.md')],
      [
        'error: sdlc-x: docs/guide.md cites knowledge/a/c.md, which kb-a does not export',
        'error: sdlc-x: docs/guide.md cites knowledge/z.md, which kb-a does not export',
      ],
    ],
    ['a citation into a slot nobody fills', [cite('companies/x.md', 'company-knowledge-storage')], []],
  ])('%s', (_title, citations, expected) => {
    const result = resolveInstall(input([kb('kb-a'), sdlc('sdlc-x')], { citations }));
    expect(lines(result)).toEqual(expected);
  });

  it('is met when any provider of a many-provider slot exports the path', () => {
    const result = resolveInstall(
      input(
        [
          candidate('co-a', {
            slot: 'company-knowledge-storage',
            offers: ['company-kb/v1'],
            exports: ['companies/a.md'],
          }),
          candidate('co-b', {
            slot: 'company-knowledge-storage',
            offers: ['company-kb/v1'],
            exports: ['companies/b.md'],
          }),
          sdlc('sdlc-x', { needs: [] }),
        ],
        { citations: [cite('companies/b.md', 'company-knowledge-storage')] },
      ),
    );
    expect(result.status).toBe('resolved');
  });
});

describe('AC-5.7 one provider or many', () => {
  it.each([
    ['two local providers', [kb('kb-b'), kb('kb-a')]],
    ['two public providers', [kb('kb-b', { origin: 'public' }), kb('kb-a', { origin: 'public' })]],
  ])('%s fail naming both, first by name', (_title, candidates) => {
    const result = resolveInstall(input(candidates));
    expect(lines(result)).toEqual([
      'error: slot knowledge-storage allows one provider but kb-a and kb-b both fill it; pick one with: use <name> <source>',
    ]);
  });
});

describe('AC-5.8 an unknown slot skips only that component', () => {
  it.each([
    ['a manifest in an unknown slot', candidate('odd', { slot: 'no-such-slot' }), 'no-such-slot'],
    [
      'a dependency on an unknown slot',
      sdlc('odd', { needs: [{ slot: 'no-such-slot', contract: 'x/v1' }] }),
      'no-such-slot',
    ],
  ])('%s', (_title, odd, slot) => {
    const result = resolveInstall(input([odd, kb('kb-a')]));
    expect(result.skipped).toEqual([{ name: 'odd', reason: { kind: 'unknown-slot', slot } }]);
    expect(names(result)).toEqual(['kb-a']);
    expect(result.status).toBe('resolved');
  });

  it('a list component in the reserved core slot is left out', () => {
    const result = resolveInstall(input([candidate('imposter', { slot: 'core' }), kb('kb-a')]));
    expect(result.skipped[0]?.reason).toMatchObject({ kind: 'invalid' });
    expect(names(result)).toEqual(['kb-a']);
  });
});

describe('AC-5.9 the runtime', () => {
  const needsNode = (range: string): Candidate => sdlc('sdlc-x', { runtime: { node: range } });
  it.each([
    [
      'older than needed',
      '>=24.12',
      { node: 'v24.11.0' },
      ['error: component sdlc-x needs node >=24.12, found 24.11.0'],
    ],
    ['exactly what is needed', '>=24.12', { node: 'v24.12.0' }, []],
    ['newer', '>=24.12', { node: '25.1.0' }, []],
    [
      'over a ceiling',
      '>=24.12 <25',
      { node: '25.0.0' },
      ['error: component sdlc-x needs node >=24.12 <25, found 25.0.0'],
    ],
    ['a tool that is not reported', '>=24.12', {}, ['error: component sdlc-x needs node >=24.12, found not found']],
    [
      'a range that cannot be read',
      'latest',
      { node: '24.12.0' },
      ['error: component sdlc-x needs node latest, found 24.12.0'],
    ],
    ['a prototype name as the tool', '>=1', { node: '24.12.0', toString: 'x' }, []],
  ])('%s', (_title, range, runtime, expected) => {
    const result = resolveInstall(input([kb('kb-a'), needsNode(range)], { runtime }));
    expect(lines(result)).toEqual(expected);
  });

  it('checks every tool of a component in name order', () => {
    const result = resolveInstall(
      input([kb('kb-a'), sdlc('sdlc-x', { runtime: { node: '>=99', git: '>=99' } })], {
        runtime: { node: '24.12.0', git: '2.50.1' },
      }),
    );
    expect(lines(result)).toEqual([
      'error: component sdlc-x needs git >=99, found 2.50.1',
      'error: component sdlc-x needs node >=99, found 24.12.0',
    ]);
  });
});

describe('the core component', () => {
  const core = manifest('agent-config', { slot: 'core' });
  const wantsCore = sdlc('sdlc-x', { needs: [{ slot: 'core', contract: 'component/v1' }] });

  it('fills the reserved slot and offers the slot contract, and installs first', () => {
    const result = resolveInstall(input([wantsCore], { core }));
    expect(names(result)).toEqual(['agent-config', 'sdlc-x']);
    expect(result.install[0]).toMatchObject({ origin: 'core', source: undefined });
  });

  it('is a need when the core manifest could not be read', () => {
    const result = resolveInstall(input([wantsCore]));
    expect(result.needs).toEqual([{ slot: 'core', contract: 'component/v1', requiredBy: ['sdlc-x'], suggested: [] }]);
  });
});

describe('what wins when several things are wrong', () => {
  it('errors win over needs, and are ordered count, cycle, contract, export, runtime', () => {
    const result = resolveInstall(
      input(
        [
          kb('kb-b'),
          kb('kb-a'),
          sdlc('s1', { runtime: { node: '>=99' } }),
          candidate('c1', { slot: 'framework', offers: ['c1/v1'], needs: [{ slot: 'framework', contract: 'c1/v1' }] }),
          sdlc('s2', { needs: [{ slot: 'company-knowledge-storage', contract: 'company-kb/v1' }] }),
        ],
        { citations: [{ consumer: 's1', file: 'f.md', slot: 'knowledge-storage', locationPath: 'knowledge/zzz.md' }] },
      ),
    );
    expect(result.status).toBe('failed');
    expect(result.errors.map((error) => error.kind)).toEqual(['count', 'cycle', 'export', 'runtime']);
    expect(result.needs).toHaveLength(1);
  });
});
