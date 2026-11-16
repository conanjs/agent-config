// DR-418: a component that fails acquire or validation goes back to its locked previous version, or is left out, and the checks run
// again until nothing changes.
import { describe, expect, it } from 'vitest';
import type { ComponentManifest } from '#manifests/application/ManifestTypes.ts';
import { settleResolution } from '#resolution/application/settleResolution.ts';
import type { Candidate, ResolveInput } from '#resolution/application/ResolutionTypes.ts';

const slots = {
  slots: [
    { name: 'knowledge-storage', reserved: false, multiple: false, contracts: ['knowledge-provider/v1'] },
    { name: 'framework', reserved: false, multiple: true, contracts: ['framework/v1'] },
  ],
};

function component(name: string, slot: string, offers: string[], needs: string[] = []): Candidate {
  const manifest: ComponentManifest = {
    name,
    version: '1.0.0',
    slot,
    repository: undefined,
    scope: undefined,
    contractsPin: 1,
    locations: {},
    provides: { contracts: offers, index: undefined, exports: [], skills: undefined, agents: undefined, services: [] },
    depends: {
      slots: needs.map((contract) => ({
        slot: 'knowledge-storage',
        contract,
        required: true,
        docs: [],
        suggest: undefined,
      })),
      runtime: {},
    },
    routes: [],
    hooks: [],
    variables: [],
    idleCost: {},
  };
  return { name, origin: 'local', source: { type: 'path', path: `/src/${name}` }, manifest };
}

const consumer = component('sdlc-x', 'framework', ['framework/v1'], ['knowledge-provider/v1']);
const input = (candidates: Candidate[]): ResolveInput => ({
  slots,
  candidates,
  core: undefined,
  citations: [],
  runtime: {},
});

describe('settleResolution', () => {
  it('changes nothing when every component passes', () => {
    const settled = settleResolution(
      input([component('kb-a', 'knowledge-storage', ['knowledge-provider/v1']), consumer]),
      () => [],
      new Map(),
    );
    expect(settled.result.status).toBe('resolved');
    expect(settled.restored).toEqual([]);
    expect(settled.leftOut).toEqual([]);
  });

  it('does not ask for staged results of a resolution that already failed', () => {
    const next = component('kb-a', 'knowledge-storage', ['knowledge-provider/v2']);
    const before = component('kb-a', 'knowledge-storage', ['knowledge-provider/v1']);
    let calls = 0;
    const settled = settleResolution(
      input([next, consumer]),
      (result) => {
        calls += 1;
        return result.install.some(
          (each) => each.name === 'kb-a' && each.manifest.provides.contracts.includes('knowledge-provider/v2'),
        )
          ? ['kb-a']
          : [];
      },
      new Map([['kb-a', before]]),
    );
    expect(settled.result.status).toBe('failed');
    expect(calls).toBe(0);
  });

  it('restores a provider that fails staged validation and re-checks the consumer against the old version', () => {
    const next = component('kb-a', 'knowledge-storage', ['knowledge-provider/v1', 'knowledge-provider/v2']);
    const before = component('kb-a', 'knowledge-storage', ['knowledge-provider/v1']);
    const settled = settleResolution(
      input([next, consumer]),
      (result) => result.install.filter((each) => each.manifest === next.manifest).map((each) => each.name),
      new Map([['kb-a', before]]),
    );
    expect(settled.result.status).toBe('resolved');
    expect(settled.restored).toEqual(['kb-a']);
    expect(settled.result.install.find((each) => each.name === 'kb-a')?.manifest).toBe(before.manifest);
  });

  it('leaves out a failing component that has no previous version, and the consumer then needs the slot', () => {
    const settled = settleResolution(
      input([component('kb-a', 'knowledge-storage', ['knowledge-provider/v1']), consumer]),
      (result) => result.install.filter((each) => each.name === 'kb-a').map((each) => each.name),
      new Map(),
    );
    expect(settled.leftOut).toEqual(['kb-a']);
    expect(settled.result.status).toBe('needs');
    expect(settled.result.needs[0]?.slot).toBe('knowledge-storage');
  });

  it('ends when a restored component fails again: it is then left out', () => {
    const kb = component('kb-a', 'knowledge-storage', ['knowledge-provider/v1']);
    const settled = settleResolution(
      input([kb, consumer]),
      (result) => result.install.filter((each) => each.name === 'kb-a').map((each) => each.name),
      new Map([['kb-a', kb]]),
    );
    expect(settled.restored).toEqual([]);
    expect(settled.leftOut).toEqual(['kb-a']);
  });

  it('ignores a failing name that is not a candidate, such as agent-config itself', () => {
    const settled = settleResolution(input([consumer]), () => ['agent-config'], new Map());
    expect(settled.leftOut).toEqual([]);
  });
});
