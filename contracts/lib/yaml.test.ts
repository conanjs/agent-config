// Tests of the one yaml wrapper (specs/022 T054): the M-17 limits against hostile files, and the vendored copy against the lockfile.
// Test titles start with the id of the rule they prove: M-17 (decisions/security.md), DR-102 and DR-606 (research.md).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  MAX_YAML_BYTES,
  MAX_YAML_FINDINGS,
  YAML_VERSION,
  YamlFailure,
  readYaml,
  readYamlDocument,
  type YamlFinding,
} from './yaml.ts';
import { compareVendoredYaml, lockedYamlDir, vendoredYamlDir } from '#contracts/tools/vendor-yaml.ts';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const contractsDir = path.join(repoRoot, 'contracts');

function findingsOf(text: string): readonly YamlFinding[] {
  const result = readYaml(text);
  if (result.ok) throw new Error(`expected the text to be refused, but it read as ${JSON.stringify(result.value)}`);
  return result.findings;
}

function codesOf(text: string): string[] {
  return findingsOf(text).map((finding) => finding.code);
}

/** The classic nested-alias "billion laughs" file: each level lists the previous one ten times. */
function aliasBomb(levels: number): string {
  const lines = ['l0: &l0 [x, x, x, x, x, x, x, x, x, x]'];
  for (let level = 1; level <= levels; level += 1) {
    lines.push(
      `l${level}: &l${level} [${Array<string>(10)
        .fill(`*l${level - 1}`)
        .join(', ')}]`,
    );
  }
  return lines.join('\n');
}

describe('M-17 a plain file reads as the library reads it', () => {
  it.each([
    ['a map', 'a: 1\nb: [x, y]\n', { a: 1, b: ['x', 'y'] }],
    ['an empty file', '', null],
    ['a file of comments only', '# nothing here\n', null],
    ['a byte order mark first', '\uFEFFa: 1', { a: 1 }],
    ['a tag of the core schema', 'a: !!str 5', { a: '5' }],
    ['an anchor that nothing refers to', 'a: &x 1', { a: 1 }],
    ['a merge key, which stays a plain key (YAML 1.2)', 'a:\n  <<: 1', { a: { '<<': 1 } }],
    ['a date, which stays text', 'a: 2001-01-01', { a: '2001-01-01' }],
  ])('%s', (_label, text, expected) => {
    expect(readYaml(text)).toEqual({ ok: true, value: expected });
  });

  it('a key named __proto__ is an own key and leaves Object.prototype alone', () => {
    const result = readYaml('__proto__:\n  polluted: true');
    expect(result.ok).toBe(true);
    expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
    expect(result.ok && Object.keys(result.value as object)).toEqual(['__proto__']);
  });
});

describe('M-17 no custom tags (DR-606: resolveKnownTags false, no customTags)', () => {
  it.each([
    ['an unknown local tag', 'a: !foo bar'],
    ['!!binary, which would silently become a Buffer', 'a: !!binary aGk='],
    ['!!set', 'a: !!set {x}'],
    ['a verbatim tag', 'a: !<tag:example.com,2000:thing> 1'],
    ['a %TAG directive and its tag', '%TAG !e! tag:example.com,2000:\n---\na: !e!x 1'],
  ])('%s is refused with TAG_RESOLVE_FAILED', (_label, text) => {
    expect(codesOf(text)).toContain('TAG_RESOLVE_FAILED');
  });
});

describe('M-17 alias limit (DR-606: toJS maxAliasCount 0)', () => {
  it('a nested alias bomb of ten levels is refused without being expanded', () => {
    expect(codesOf(aliasBomb(10))).toEqual([YamlFailure.AliasRefused]);
  });

  it('one alias to a scalar is refused, naming aliases', () => {
    const [finding] = findingsOf('a: &x 1\nb: *x');
    expect(finding).toMatchObject({ code: YamlFailure.AliasRefused });
    expect(finding?.message).toContain('aliases');
  });

  it('an alias used as a merge source is refused too', () => {
    expect(codesOf('base: &b {k: 1}\nuse:\n  <<: *b')).toEqual([YamlFailure.AliasRefused]);
  });

  it('the editing document refuses an alias before the caller can change anything', () => {
    expect(readYamlDocument('a: &x 1\nb: *x')).toMatchObject({ ok: false });
  });
});

describe('M-17 size cap of 256 KiB per file', () => {
  it('a text of exactly 262144 bytes is read', () => {
    const text = `a: ${'x'.repeat(MAX_YAML_BYTES - 3)}`;
    expect(Buffer.byteLength(text)).toBe(MAX_YAML_BYTES);
    expect(readYaml(text).ok).toBe(true);
  });

  it('a text one byte over is refused before parsing, naming both sizes', () => {
    const text = `a: ${'x'.repeat(MAX_YAML_BYTES - 2)}`;
    const [finding] = findingsOf(text);
    expect(finding).toMatchObject({ code: YamlFailure.TooLarge, line: undefined });
    expect(finding?.message).toContain('262145');
    expect(finding?.message).toContain('262144');
  });

  it('the cap counts UTF-8 bytes, not characters', () => {
    const text = `a: ${'\u00e9'.repeat(131_071)}`;
    expect(text.length).toBeLessThan(MAX_YAML_BYTES);
    expect(codesOf(text)).toEqual([YamlFailure.TooLarge]);
  });

  it('a text that is over the cap and also broken reports the size only', () => {
    expect(codesOf(`a: [${'x'.repeat(MAX_YAML_BYTES)}`)).toEqual([YamlFailure.TooLarge]);
  });
});

describe('M-17 nesting too deep is a refusal, not a crash', () => {
  it.each([
    ['1000 open brackets', '['.repeat(1_000)],
    ['the largest text of open brackets', '['.repeat(MAX_YAML_BYTES)],
    ['20000 nested flow mappings', '{a: '.repeat(20_000)],
  ])('%s gives RESOURCE_EXHAUSTION and at most ten findings', (_label, text) => {
    const findings = findingsOf(text);
    expect(findings.map((finding) => finding.code)).toContain(YamlFailure.ResourceExhausted);
    expect(findings.length).toBeLessThanOrEqual(MAX_YAML_FINDINGS);
  });

  it('a nest of 500 brackets that closes is still read', () => {
    expect(readYaml('['.repeat(500) + ']'.repeat(500)).ok).toBe(true);
  });
});

describe('M-17 one document, unique keys', () => {
  it('a second document is MULTIPLE_DOCS, not dropped silently (DR-606: logLevel error, not silent)', () => {
    expect(codesOf('a: 1\n---\nb: 2')).toContain('MULTIPLE_DOCS');
  });

  it('a duplicate key is DUPLICATE_KEY and names its line', () => {
    const [finding] = findingsOf('a: 1\nb: 2\na: 3');
    expect(finding).toMatchObject({ code: 'DUPLICATE_KEY', line: 3 });
  });

  it('a duplicate key in a nested map is found too', () => {
    expect(codesOf('outer:\n  k: 1\n  k: 2')).toContain('DUPLICATE_KEY');
  });
});

describe('M-17 keys: one pass, duplicates across scalar types, no collection keys', () => {
  it.each([
    ['1 and "1"', '1: a\n"1": b'],
    ['true and "true"', 'true: a\n"true": b'],
    ['0x1 and 1', '0x1: a\n1: b'],
    ['007 and 7', '007: a\n7: b'],
    ['null and the empty text', 'null: a\n"": b'],
    ['~ and the empty text', '~: a\n"": b'],
    ['an empty key and the empty text', ': a\n"": b'],
    ['a flow map', '{a: 1, a: 2}'],
    ['a key repeated in a map inside a list', 'x:\n  - k: 1\n    k: 2'],
  ])('%s are one key: DUPLICATE_KEY', (_label, text) => {
    expect(codesOf(text)).toContain('DUPLICATE_KEY');
  });

  it('the same key in two different mappings is fine', () => {
    expect(readYaml('a:\n  k: 1\nb:\n  k: 2').ok).toBe(true);
  });

  it.each([
    ['a list as a key', '? [a, b]\n: 1'],
    ['a map as a key', '? {a: 1}\n: 1'],
    ['a flow list as a key', '{[a]: 1}'],
  ])('%s is refused with NON_STRING_KEY', (_label, text) => {
    expect(codesOf(text)).toContain(YamlFailure.NonStringKey);
  });

  it('a 256 KiB flow map of tens of thousands of keys reads (the duplicate check is one pass; no time is asserted)', () => {
    const keys: string[] = [];
    let bytes = 2;
    for (let key = 0; bytes + String(key).length + 3 <= MAX_YAML_BYTES; key += 1) {
      keys.push(`${key}:`);
      bytes += String(key).length + 2;
    }
    const text = `{${keys.join(',')}}`;
    expect(Buffer.byteLength(text)).toBeLessThanOrEqual(MAX_YAML_BYTES);
    expect(keys.length).toBeGreaterThan(30_000);
    const result = readYaml(text);
    expect(result.ok && Object.keys(result.value as object).length).toBe(keys.length);
  });

  it('a duplicate at the end of that map is still found', () => {
    expect(codesOf('{a: 1, b: 2, c: 3, a: 4}')).toEqual(['DUPLICATE_KEY']);
  });
});

describe('Q-SEC-5 a finding never repeats the text of the file', () => {
  it.each([
    ['an unknown tag', 'a: !ghp_SECRET x'],
    ['a verbatim tag', 'a: !<tag:ghp_SECRET> x'],
    ['a directive', '%ghp_SECRET x\n---\na: 1'],
    ['a %TAG directive', '%TAG !e! tag:ghp_SECRET,2000:\n---\na: !e!x 1'],
    ['a bad escape', 'a: "\\ghp_SECRET"'],
    ['a bad scalar start', 'a: @ghp_SECRET'],
    ['a back-tick scalar start', 'a: `ghp_SECRET'],
    ['a tag after an anchor in the wrong order', 'a: &x !ghp_SECRET y'],
    ['an unexpected token', 'a: [1, 2] ghp_SECRET'],
    ['a key with the secret twice', 'ghp_SECRET: 1\nghp_SECRET: 2'],
    ['a bad indent', 'a:\n  b: 1\n ghp_SECRET: 2'],
    ['an alias', 'a: &ghp_SECRET 1\nb: *ghp_SECRET'],
    ['an unclosed quote', 'a: "ghp_SECRET'],
    ['a tab indent', 'a:\n\tghp_SECRET: 1'],
  ])('%s', (_label, text) => {
    const findings = findingsOf(text);
    expect(findings.length).toBeGreaterThan(0);
    expect(JSON.stringify(findings)).not.toContain('ghp_SECRET');
  });

  it('RESOURCE_EXHAUSTION has a fixed sentence too', () => {
    const [finding] = findingsOf('['.repeat(1_000));
    expect(finding).toMatchObject({ code: 'RESOURCE_EXHAUSTION', message: 'nesting is too deep to read' });
  });

  it('every finding keeps its code and a line when the library gave one', () => {
    expect(findingsOf('a: !foo x')[0]).toMatchObject({ code: 'TAG_RESOLVE_FAILED', line: 1 });
  });
});

describe('M-17 broken text is a finding with one line of message', () => {
  it.each([
    ['an unclosed bracket', 'a: [1, 2'],
    ['a tab as indent', 'a:\n\t- 1'],
  ])('%s', (_label, text) => {
    const findings = findingsOf(text);
    expect(findings.length).toBeGreaterThan(0);
    for (const finding of findings) expect(finding.message).not.toContain('\n');
  });
});

describe('DR-606 the document form keeps comments and obeys the same limits', () => {
  it('a value set through the document leaves the comments in the printed text', () => {
    const result = readYamlDocument('# V edits this\nsource: git # kept\nname: kb\n');
    if (!result.ok) throw new Error('the document should read');
    result.value.setIn(['source'], 'path');
    expect(result.value.toString()).toBe('# V edits this\nsource: path # kept\nname: kb\n');
  });

  it('an oversize text is refused by the document form as well', () => {
    expect(readYamlDocument(`a: ${'x'.repeat(MAX_YAML_BYTES)}`)).toMatchObject({ ok: false });
  });
});

describe('DR-102 the vendored copy is the locked package', () => {
  const lockText = fs.readFileSync(path.join(repoRoot, 'pnpm-lock.yaml'), 'utf8');
  const pinnedByPackageJson = (
    JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8')) as Record<string, unknown>
  )['devDependencies'] as Record<string, string>;
  const installed = (
    JSON.parse(fs.readFileSync(path.join(lockedYamlDir, 'package.json'), 'utf8')) as { version: string }
  ).version;

  it('package.json, pnpm-lock.yaml, node_modules and the wrapper name one version', () => {
    const lockedPackages = [...lockText.matchAll(/^ {2}yaml@(\S+):$/gm)].map((match) => match[1]);
    expect({
      packageJson: pinnedByPackageJson['yaml'],
      lockfile: lockedPackages,
      installed,
      wrapper: YAML_VERSION,
    }).toEqual({ packageJson: YAML_VERSION, lockfile: [YAML_VERSION], installed: YAML_VERSION, wrapper: YAML_VERSION });
  });

  it('the lockfile records an integrity hash for that version', () => {
    expect(lockText).toMatch(
      new RegExp(`^ {2}yaml@${YAML_VERSION.replaceAll('.', '\\.')}:\\n {4}resolution: \\{integrity: sha512-`, 'm'),
    );
  });

  it('the vendored folder equals browser/dist of the locked package, byte for byte, plus LICENSE', () => {
    expect(compareVendoredYaml(lockedYamlDir, vendoredYamlDir)).toEqual([]);
  });

  describe('the comparison itself', () => {
    function copyOfVendored(): string {
      const copy = fs.mkdtempSync(path.join(os.tmpdir(), 'vendored-yaml-'));
      fs.cpSync(vendoredYamlDir, copy, { recursive: true });
      return copy;
    }

    it('reports one changed byte', () => {
      const copy = copyOfVendored();
      const file = path.join(copy, 'index.js');
      fs.writeFileSync(file, `${fs.readFileSync(file, 'utf8')} `);
      expect(compareVendoredYaml(lockedYamlDir, copy)).toEqual(['differs from the locked package: index.js']);
    });

    it('reports a missing file and an extra file', () => {
      const copy = copyOfVendored();
      fs.rmSync(path.join(copy, 'util.js'));
      fs.writeFileSync(path.join(copy, 'extra.js'), '');
      expect(compareVendoredYaml(lockedYamlDir, copy)).toEqual([
        'missing in the copy: util.js',
        'not in the locked package: extra.js',
      ]);
    });
  });
});

describe('DR-102 the wrapper is the only importer of yaml', () => {
  function sourceFiles(dir: string): string[] {
    return fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.name !== 'vendor' && entry.name !== 'node_modules')
      .flatMap((entry) => {
        const full = path.join(dir, entry.name);
        return entry.isDirectory() ? sourceFiles(full) : entry.name.endsWith('.ts') ? [full] : [];
      });
  }

  it('no other file under contracts/ imports the yaml package or the vendored folder', () => {
    const importers = sourceFiles(contractsDir)
      .filter((file) =>
        /from\s+['"](yaml|#contracts\/lib\/vendor\/yaml[^'"]*|[./]+[^'"]*vendor\/yaml[^'"]*)['"]/.test(
          fs.readFileSync(file, 'utf8'),
        ),
      )
      .map((file) => path.relative(contractsDir, file).split(path.sep).join('/'));
    expect(importers).toEqual(['lib/yaml.ts']);
  });
});
