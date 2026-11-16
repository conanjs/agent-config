// Tests of the citation classifier (specs/022 T056). The rows come from the shared rule table (citation-cases.ts), so the dry run,
// `build cite` and the renderer can run the very same rows; the tests below it add what only this module needs.
// Test titles start with the id they prove: AC-5.10 and FR-023 (spec.md), SL-4 (slots-v1.md), A-24, M-03.
import { describe, expect, it } from 'vitest';
import { citationCases, sharedLocationRules } from './citation-cases.ts';
import { classifyCitation, locationRulesFromSlots, type LocationRule } from './citations.ts';

describe('AC-5.10 the shared rule table', () => {
  it.each(citationCases)('$title', ({ text, expected }) => {
    const classified = classifyCitation(text, sharedLocationRules);
    if (expected.ok) {
      expect(classified).toEqual({ ok: true, citation: expected.citation });
    } else {
      expect(classified.ok).toBe(false);
      if (classified.ok) return;
      expect(classified.failure.code).toBe(expected.code);
      expect(classified.failure.path).toBe(expected.path);
      // The failure message names the path (AC-5.10); an empty path has nothing to name.
      expect(classified.failure.message).toContain(expected.path);
    }
  });

  it('classifying does not depend on the order of the rules', () => {
    const reversed = [...sharedLocationRules].reverse();
    for (const { text } of citationCases) {
      expect(classifyCitation(text, reversed)).toEqual(classifyCitation(text, sharedLocationRules));
    }
  });

  it('classifying leaves the rule table as it was', () => {
    const before = JSON.stringify(sharedLocationRules);
    for (const { text } of citationCases) classifyCitation(text, sharedLocationRules);
    expect(JSON.stringify(sharedLocationRules)).toBe(before);
  });
});

describe('SL-4 the longest location prefix wins', () => {
  const nested: readonly LocationRule[] = [
    { slot: 'short', location: 'a', mount: 'frameworks' },
    { slot: 'long', location: 'b', mount: 'frameworks/sdlc' },
  ];

  it.each([
    ['frameworks/sdlc/x.md', 'long', 'x.md'],
    ['frameworks/other/x.md', 'short', 'other/x.md'],
    ['frameworks/sdlcs/x.md', 'short', 'sdlcs/x.md'],
  ])('%s is classified by the %s mount', (path, slot, rest) => {
    expect(classifyCitation(`{{AGENT_HOME}}/${path}`, nested)).toMatchObject({
      ok: true,
      citation: { slot, path: rest },
    });
  });

  it('a literal mount beats a {component} mount of the same length, wherever the rules sit in the table', () => {
    const rules: readonly LocationRule[] = [
      { slot: 'framework', location: 'framework', mount: 'frameworks/{component}' },
      { slot: 'knowledge-storage', location: 'framework', mount: 'frameworks/knowledge' },
    ];
    expect(classifyCitation('{{AGENT_HOME}}/frameworks/knowledge/x.md', rules)).toMatchObject({
      ok: true,
      citation: { slot: 'knowledge-storage' },
    });
    expect(classifyCitation('{{AGENT_HOME}}/frameworks/knowledge/x.md', [...rules].reverse())).toMatchObject({
      ok: true,
      citation: { slot: 'knowledge-storage' },
    });
  });

  it('a longer {component} mount beats a shorter literal one', () => {
    const rules: readonly LocationRule[] = [
      { slot: 'a', location: 'x', mount: 'frameworks' },
      { slot: 'b', location: 'y', mount: 'frameworks/{component}' },
    ];
    expect(classifyCitation('{{AGENT_HOME}}/frameworks/sdlc/x.md', rules)).toMatchObject({
      ok: true,
      citation: { slot: 'b' },
    });
  });

  it('with no rules at all every location path fails and bare paths still read as own files', () => {
    expect(classifyCitation('{{AGENT_HOME}}/knowledge/a.md', [])).toMatchObject({ ok: false });
    expect(classifyCitation('a.md', [])).toEqual({ ok: true, citation: { kind: 'own', path: 'a.md' } });
  });
});

describe('FR-023 the rules come from the slots file', () => {
  const slotsFile = {
    schema: 'slots/v1',
    slots: [
      {
        name: 'core',
        locations: [
          { name: 'core', mount: 'core' },
          { name: 'atlas', mount: 'atlas' },
        ],
      },
      { name: 'framework', locations: [{ name: 'framework', mount: 'frameworks/{component}' }] },
    ],
  };

  it('every mount of every slot becomes a rule, in file order, then the extra rules', () => {
    const extra: readonly LocationRule[] = [
      { slot: 'core', location: 'global-variables', mount: 'global-variables.md' },
    ];
    expect(locationRulesFromSlots(slotsFile, extra)).toEqual([
      { slot: 'core', location: 'core', mount: 'core' },
      { slot: 'core', location: 'atlas', mount: 'atlas' },
      { slot: 'framework', location: 'framework', mount: 'frameworks/{component}' },
      ...extra,
    ]);
  });

  it.each([
    ['null', null],
    ['a list', []],
    ['slots that is not a list', { slots: 'x' }],
    ['a slot with no locations', { slots: [{ name: 'core' }] }],
    ['a location with no mount', { slots: [{ name: 'core', locations: [{ name: 'core' }] }] }],
    ['entries that are not mappings', { slots: [1, null, 'x'] }],
  ])('%s gives no rules and no error', (_label, value) => {
    expect(locationRulesFromSlots(value)).toEqual([]);
  });
});
