// Unit tests of the coverage check (specs/022 T083). The scenarios of tests/coverage/coverage.feature drive the whole script;
// these pin the readers it is built from. Test titles start with the id they prove: QB-1 and QB-2 (decisions/qa.md), AC-1.1 and
// AC-1.10 (the ids whose prefix problem the check must not have).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { coverage, exemptionFindings, readExemptions, readSpecIds, run, scenarioLeads } from './check-ac-coverage.ts';

const spec = `# Spec
### User Story 1 - First (Priority: P1) (Phase 0)
1. **AC-1.1** **Given** a, **Then** b.
2. **AC-1.10** **Given** a, **Then** b.
### User Story 2 - Later (Priority: P1) (Phase 2)
1. **AC-2.1** **Given** a, **Then** b.
### User Story 3 - No phase stated (Priority: P3)
1. **AC-3.1** **Given** a, **Then** b.
- **EDGE-1** An edge case.
- **A-19** An assumption.
| SC-002 | G2 | A success criterion | AC-2.1 |
`;

describe('QB-1 reading the ids of the spec', () => {
  it('gives each AC the phase of its story heading', () => {
    expect(readSpecIds(spec).criteria).toEqual([
      { id: 'AC-1.1', phase: 0 },
      { id: 'AC-1.10', phase: 0 },
      { id: 'AC-2.1', phase: 2 },
    ]);
  });

  it('an AC under a story with no stated phase is known but never due', () => {
    expect(readSpecIds(spec).known.has('AC-3.1')).toBe(true);
    expect(readSpecIds(spec).criteria.some((c) => c.id === 'AC-3.1')).toBe(false);
  });

  it('knows the assumption, edge case and success-criterion ids', () => {
    const { known } = readSpecIds(spec);
    expect([...known]).toEqual(expect.arrayContaining(['A-19', 'EDGE-1', 'SC-002']));
  });

  it('an id that appears only in prose is not defined', () => {
    expect(readSpecIds('Mentions AC-9.9 and A-77 in a sentence.').known.size).toBe(0);
  });
});

describe('QB-1 reading scenario titles', () => {
  it('takes the first word of each title, outlines and colons included', () => {
    const text =
      'Feature: F\n  Scenario: AC-1.1 First\n  Scenario Outline: AC-1.2: Second <x>\n    Given AC-9.9 inside';
    expect(scenarioLeads(text)).toEqual(['AC-1.1', 'AC-1.2']);
  });

  it('AC-1.1 and AC-1.10 are different leads', () => {
    const due = [{ id: 'AC-1.10', phase: 0 }];
    const result = coverage(due, new Set([0]), new Set(scenarioLeads('Scenario: AC-1.1 only the first')), new Set());
    expect(result.findings).toEqual(['QB-1 AC-1.10 has no scenario (phase 0)']);
  });
});

describe('QB-1 coverage of delivered phases', () => {
  const criteria = [
    { id: 'AC-1.1', phase: 0 },
    { id: 'AC-2.1', phase: 2 },
  ];

  it('counts only the delivered phases', () => {
    expect(coverage(criteria, new Set([0]), new Set(['AC-1.1']), new Set())).toEqual({
      findings: [],
      total: 1,
      covered: 1,
    });
  });

  it('an exempt id counts as covered', () => {
    expect(coverage(criteria, new Set([0, 2]), new Set(['AC-1.1']), new Set(['AC-2.1']))).toEqual({
      findings: [],
      total: 2,
      covered: 2,
    });
  });

  it('names the id and its phase when nothing covers it', () => {
    expect(coverage(criteria, new Set([0, 2]), new Set(), new Set()).findings).toEqual([
      'QB-1 AC-1.1 has no scenario (phase 0)',
      'QB-1 AC-2.1 has no scenario (phase 2)',
    ]);
  });
});

describe('QB-2 the exemption list', () => {
  const known = new Set(['AC-2.2', 'A-19']);

  it('accepts an entry with a reason and a replacement for an id of the spec', () => {
    expect(exemptionFindings([{ id: 'AC-2.2', reason: 'why', replacement: 'check by hand' }], known)).toEqual([]);
  });

  it('rejects a missing, empty or blank reason and replacement, and an id the spec lacks', () => {
    expect(exemptionFindings([{ id: 'AC-2.2', reason: undefined, replacement: '  ' }], known)).toEqual([
      'QB-2 exemption AC-2.2 has no reason',
      'QB-2 exemption AC-2.2 has no manual replacement',
    ]);
    expect(exemptionFindings([{ id: 'A-99', reason: 'r', replacement: 'm' }], known)).toEqual([
      'QB-2 exemption A-99 is not an id in spec.md',
    ]);
  });

  it('reads a list that has the schema and refuses one that does not', () => {
    expect(readExemptions(null)).toEqual({ entries: [] });
    expect(
      readExemptions('schema: ac-exemptions/v1\nexemptions:\n  - id: A-19\n    reason: r\n    replacement: m\n')
        .entries,
    ).toEqual([{ id: 'A-19', reason: 'r', replacement: 'm' }]);
    expect(readExemptions('exemptions: []\n').problem).toContain('schema: ac-exemptions/v1');
    expect(readExemptions('schema: ac-exemptions/v1\nexemptions:\n  - reason: r\n').problem).toContain('needs an id');
    expect(readExemptions('a: [').problem).toContain('cannot be read');
  });
});

describe('QB-1 running on a tree', () => {
  const folders: string[] = [];
  afterEach(() => {
    for (const folder of folders.splice(0)) fs.rmSync(folder, { recursive: true, force: true });
  });

  function tree(files: Record<string, string>): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'coverage-'));
    folders.push(root);
    for (const [name, text] of Object.entries({ 'specs/022-repo-split/spec.md': spec, ...files })) {
      fs.mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
      fs.writeFileSync(path.join(root, name), text);
    }
    return root;
  }

  it('prints the covered count when every delivered id is covered', () => {
    const root = tree({ 'tests/a/a.feature': 'Scenario: AC-1.1 x\nScenario: AC-1.10 y\n' });
    expect(run(root, new Set([0]))).toEqual({
      code: 0,
      lines: ['check-ac-coverage: 2 of 2 delivered ids covered or exempt'],
    });
  });

  it('does not read scenario titles under a folder named fixtures', () => {
    const root = tree({ 'tests/a/fixtures/a.feature': 'Scenario: AC-1.1 x\nScenario: AC-1.10 y\n' });
    expect(run(root, new Set([0])).lines).toEqual([
      'QB-1 AC-1.1 has no scenario (phase 0)',
      'QB-1 AC-1.10 has no scenario (phase 0)',
    ]);
  });

  it('fails on a missing spec', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'coverage-'));
    folders.push(root);
    expect(run(root, new Set([0])).code).toBe(1);
  });
});
