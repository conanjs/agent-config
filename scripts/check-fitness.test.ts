// Unit tests of the fitness check (specs/022 T081). The scenarios of tests/fitness/fitness.feature drive the whole script;
// these pin the parts they cannot reach: the registry reader, the two kinds of count, the `mention-in` override and `--measure`.
// Test titles start with the id they prove: AC-1.6 and FR-008 (spec.md), FIT-1 to FIT-3 (the check's messages).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  compareCounts,
  countChecks,
  countMentions,
  forbiddenEdgeFindings,
  measure,
  architectureFindings,
  readArchitectureLayers,
  readBaseline,
  readRegistry,
  run,
  type Component,
  type SourceFile,
} from './check-fitness.ts';

const atlas = `
components:
  - { id: core, paths: [core], mention: "core/", mention-in: { companies: 'core/(?!<)' } }
  - { id: knowledge, paths: [knowledge], mention: "knowledge/", layer: knowledge-layer }
  - { id: companies, paths: [companies], mention: "companies/", mention-in: { core: 'x/companies/(?!<)' } }
  - { id: contracts, paths: [contracts], mention: "contracts/" }
component-edges:
  - { from: core, to: knowledge }
forbidden-edges:
  - { from: knowledge, to: companies }
  - { from: contracts, to: "*" }
`;

const architecture = [
  '```yaml',
  'layers:',
  '  - { name: core, may-depend-on: [knowledge-layer] }',
  '  - { name: knowledge-layer, may-depend-on: [] }',
  '```',
  '',
].join('\n');

function registry() {
  const read = readRegistry(atlas);
  if (!read.ok) throw new Error(read.problems.join('\n'));
  return read.value;
}

function component(id: string): Component {
  const found = registry().components.find((c) => c.id === id);
  if (found === undefined) throw new Error(`no component ${id}`);
  return found;
}

const file = (name: string, text: string): SourceFile => ({ path: name, text });

describe('AC-1.6 reading the architecture map', () => {
  it('reads components, edges, forbidden edges and the default check files', () => {
    const read = registry();
    expect(read.components.map((c) => c.id)).toEqual(['core', 'knowledge', 'companies', 'contracts']);
    expect(read.edges).toEqual([{ from: 'core', to: 'knowledge' }]);
    expect(read.checkFiles).toEqual(['check-*.mjs']);
  });

  it('refuses a map with no components', () => {
    expect(readRegistry('repos: []').ok).toBe(false);
  });

  it('refuses an edge that names a component the map does not have', () => {
    const read = readRegistry(`${atlas}  - { from: knowledge, to: nowhere }\n`);
    expect(read.ok).toBe(false);
    if (!read.ok) expect(read.problems.join()).toContain('"nowhere" is not a component');
  });

  it('refuses a mention-in value that is not a regular expression', () => {
    const read = readRegistry(atlas.replace("'core/(?!<)'", "'(unclosed'"));
    expect(read.ok).toBe(false);
  });
});

describe('FR-008 forbidden edges', () => {
  const withEdges = (extra: string): ReturnType<typeof registry> => {
    const read = readRegistry(atlas.replace('component-edges:\n', `component-edges:\n${extra}`));
    if (!read.ok) throw new Error(read.problems.join('\n'));
    return read.value;
  };

  it('FIT-1 names an edge a forbidden edge covers', () => {
    expect(forbiddenEdgeFindings(withEdges('  - { from: knowledge, to: companies }\n'))).toEqual([
      'FIT-1 forbidden edge knowledge -> companies',
    ]);
  });

  it('FIT-1 expands the star to every component', () => {
    expect(
      forbiddenEdgeFindings(withEdges('  - { from: contracts, to: core }\n  - { from: contracts, to: knowledge }\n')),
    ).toEqual(['FIT-1 forbidden edge contracts -> core', 'FIT-1 forbidden edge contracts -> knowledge']);
  });

  it('allowed edges are not findings', () => {
    expect(forbiddenEdgeFindings(registry())).toEqual([]);
  });
});

describe('AC-1.6 counting mentions', () => {
  it('counts lines and files, and a file with two mentions is one file', () => {
    const documents = [
      file('a.md', 'companies/x\ncompanies/y\nplain'),
      file('b.md', 'companies/z'),
      file('c.md', 'nothing'),
    ];
    expect(countMentions(component('knowledge'), component('companies'), documents)).toEqual({ lines: 3, files: 2 });
  });

  it('uses the mention-in expression instead of the plain text for that owner', () => {
    const documents = [file('a.md', 'x/companies/<co>/\nx/companies/ots/a.md\ncompanies/ots')];
    expect(countMentions(component('core'), component('companies'), documents)).toEqual({ lines: 1, files: 1 });
  });

  it('counts a check once however many components it mentions', () => {
    const checks = new Map([['knowledge', [file('check-a.mjs', "'companies/' 'core/' 'contracts/'")]]]);
    expect(countChecks(registry().components, checks)).toBe(1);
  });

  it('does not count a check that mentions only its own component', () => {
    const checks = new Map([['knowledge', [file('check-a.mjs', "'knowledge/'")]]]);
    expect(countChecks(registry().components, checks)).toBe(0);
  });
});

describe('AC-1.6 comparing with the baseline', () => {
  it('FIT-2 reports a rise and names the fitness function: FF-1 for core, FF-2 otherwise', () => {
    const { rises } = compareCounts(
      { 'core-to-companies-lines': 1, 'knowledge-to-companies-lines': 2 },
      {
        'core-to-companies-lines': 2,
        'knowledge-to-companies-lines': 3,
      },
    );
    expect(rises.filter((l) => l.startsWith('FIT-2'))).toEqual([
      'FIT-2 core-to-companies-lines rose from 1 to 2',
      'FIT-2 knowledge-to-companies-lines rose from 2 to 3',
    ]);
    expect(rises.filter((l) => l.includes('FF-1'))).toHaveLength(1);
    expect(rises.filter((l) => l.includes('FF-2'))).toHaveLength(1);
  });

  it('a fall is a note and never a rise', () => {
    const { rises, falls } = compareCounts({ a: 3 }, { a: 1 });
    expect(rises).toEqual([]);
    expect(falls).toEqual(['note: a fell from 3 to 1; lower the baseline']);
  });

  it('an equal count says nothing', () => {
    expect(compareCounts({ a: 3 }, { a: 3 })).toEqual({ rises: [], falls: [] });
  });

  it('FIT-3 refuses a baseline that is not JSON or holds a count that is not a whole number', () => {
    expect(readBaseline('{').ok).toBe(false);
    expect(readBaseline('{"counts":{"a":-1}}').ok).toBe(false);
    expect(readBaseline('{"counts":{"a":1.5}}').ok).toBe(false);
    expect(readBaseline('{"counts":{"a":2}}')).toEqual({ ok: true, value: { a: 2 } });
  });
});

describe('AC-1.6 running on a tree', () => {
  const folders: string[] = [];
  afterEach(() => {
    for (const folder of folders.splice(0)) fs.rmSync(folder, { recursive: true, force: true });
  });

  function tree(files: Record<string, string>): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fitness-'));
    folders.push(root);
    const defaults = { 'copilot/atlas/atlas.yaml': atlas, 'docs/architecture.md': architecture };
    for (const [name, text] of Object.entries({ ...defaults, ...files })) {
      fs.mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
      fs.writeFileSync(path.join(root, name), text);
    }
    return root;
  }

  const baseline = (counts: Record<string, number>): string => JSON.stringify({ counts });

  it('passes with every count equal to its baseline', () => {
    const root = tree({
      'knowledge/a.md': 'companies/x',
      'docs/baselines/fitness.json': baseline({ 'knowledge-to-companies-lines': 1 }),
    });
    expect(run(root, false)).toEqual({ code: 0, lines: ['check-fitness: counts equal the baseline'] });
  });

  it('FIT-2 fails on a rise', () => {
    const root = tree({
      'knowledge/a.md': 'companies/x\ncompanies/y',
      'docs/baselines/fitness.json': baseline({ 'knowledge-to-companies-lines': 1 }),
    });
    const outcome = run(root, false);
    expect(outcome.code).toBe(1);
    expect(outcome.lines).toContain('FIT-2 knowledge-to-companies-lines rose from 1 to 2');
  });

  it('FIT-3 fails and names the missing baseline file', () => {
    expect(run(tree({}), false)).toEqual({
      code: 1,
      lines: ['FIT-3 baseline file missing: docs/baselines/fitness.json'],
    });
  });

  it('a folder that no longer exists counts as zero, so a move shows as a fall', () => {
    const root = tree({ 'docs/baselines/fitness.json': baseline({ 'knowledge-to-companies-lines': 2 }) });
    expect(run(root, false).code).toBe(0);
    expect(run(root, false).lines.join('\n')).toContain('fell from 2 to 0');
  });

  it('fails on a baseline key the check does not know', () => {
    const root = tree({ 'docs/baselines/fitness.json': baseline({ 'no-such-count': 1 }) });
    expect(run(root, false).code).toBe(1);
  });

  it('only .md files count as documents and skipped folders are not read', () => {
    const root = tree({
      'knowledge/a.txt': 'companies/x',
      'knowledge/node_modules/b.md': 'companies/x',
      'docs/baselines/fitness.json': baseline({ 'knowledge-to-companies-lines': 0 }),
    });
    expect(run(root, false).code).toBe(0);
  });

  it('--measure prints the measured counts for the keys of the baseline', () => {
    const root = tree({
      'knowledge/a.md': 'companies/x',
      'docs/baselines/fitness.json': baseline({ 'knowledge-to-companies-files': 0 }),
    });
    const registryRead = registry();
    expect(measure(root, registryRead, ['knowledge-to-companies-files'])).toEqual({
      ok: true,
      value: { 'knowledge-to-companies-files': 1 },
    });
    expect(JSON.parse(run(root, true).lines.join('\n'))).toEqual({ counts: { 'knowledge-to-companies-files': 1 } });
  });
});

describe('FIT-4 and FIT-5 the atlas against docs/architecture.md', () => {
  const layersOf = (text: string): ReadonlyMap<string, readonly string[]> => {
    const read = readArchitectureLayers(text);
    if (!read.ok) throw new Error(read.problems.join('\n'));
    return read.value;
  };

  it('reads the may-depend-on of every layer in every yaml block and ignores other blocks', () => {
    const text = `${architecture}\n\`\`\`text\nlayers: nope\n\`\`\`\n`;
    expect(layersOf(text)).toEqual(
      new Map([
        ['core', ['knowledge-layer']],
        ['knowledge-layer', []],
      ]),
    );
  });

  it('agrees when the atlas edges are the layer dependencies, using the component layer name', () => {
    expect(architectureFindings(registry(), layersOf(architecture))).toEqual([]);
  });

  it('FIT-4 names an atlas edge the architecture does not draw', () => {
    const none = layersOf(architecture.replace('[knowledge-layer] }', '[] }'));
    expect(architectureFindings(registry(), none)).toEqual([
      'FIT-4 atlas edge core -> knowledge is not in docs/architecture.md',
    ]);
  });

  it('FIT-5 names an architecture edge the atlas does not declare', () => {
    const more = layersOf(
      architecture.replace('knowledge-layer, may-depend-on: []', 'knowledge-layer, may-depend-on: [core]'),
    );
    expect(architectureFindings(registry(), more)).toEqual([
      'FIT-5 docs/architecture.md edge knowledge -> core is not in the atlas',
    ]);
  });

  it('leaves out a component the architecture does not name as a layer', () => {
    expect(
      architectureFindings(registry(), layersOf('```yaml\nlayers:\n  - { name: core, may-depend-on: [] }\n```\n')),
    ).toEqual([]);
  });
});
