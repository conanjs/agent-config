// Table-driven tests of the contract reader (specs/022 T055). Each table row changes one thing in a valid file and says what
// the reader must report. Test titles start with the id of the rule they prove: AC-1.2 to AC-1.4, FR-004, FR-005 (spec.md),
// M-03, M-07, M-17 (decisions/security.md), CM-4 (contracts/component-v1.md). The five valid files are the ones of
// tests/contracts/fixtures/base, written out here because contracts/ reads nothing outside itself (DR-302).
import { describe, expect, it } from 'vitest';
import { readContract, readableMajors } from './reader.ts';
import type { Finding } from './shape.ts';
import { MAX_YAML_BYTES } from './yaml.ts';

const slotsFile = `schema: slots/v1
slots:
  - name: core
    reserved: true
    contract: component/v1
    required: true
    multiple: false
    scope: global
    locations:
      - { name: core, mount: core }
      - { name: instructions, mount: instructions }
  - name: knowledge-storage
    contract: knowledge-provider/v1
    required: false
    multiple: false
    scope: global
    self-contained: true
    locations:
      - { name: content, mount: knowledge, index: provided }
      - { name: framework, mount: frameworks/knowledge }
  - name: company-knowledge-storage
    contract: [company-kb/v1, knowledge-provider/v1]
    required: false
    multiple: true
    scope: global
    locations:
      - { name: content, mount: companies, shared: true, index: generated }
  - name: framework
    contract: framework/v1
    required: false
    multiple: true
    scope: per-project
    locations:
      - { name: framework, mount: "frameworks/{component}" }
`;

const componentFile = `schema: component/v1
name: agentic-sdlc
version: 1.4.0
slot: framework
repository: https://github.com/conanjs/agentic-sdlc
scope: per-project
contracts:
  pin: 1
locations:
  framework: .
provides:
  contracts: [framework/v1]
  index: index.md
  exports: []
  skills: skills/
  agents: agents/
depends:
  slots:
    - slot: knowledge-storage
      contract: knowledge-provider/v1
      required: true
      docs: []
    - slot: core
      contract: component/v1
      docs: []
  runtime:
    node: ">=24.12"
routes:
  - id: agentic-sdlc
    when: The project has a .specify/ folder
    read: frameworks/agentic-sdlc/index.md
hooks: []
variables:
  - name: REFERENCE_REPOS_ROOT
    description: Folder holding reference repositories cloned for comparison
    required: false
idle-cost:
  claude-code: 3500
  copilot-cli: 3200
  codex: 0
`;

const listFile = `schema: components-list/v1
local: false
components:
  - name: agent-knowledge
    source: { type: git, url: "https://github.com/conanjs/agent-knowledge.git", ref: main }
  - name: agentic-sdlc
    source: { type: git, url: "https://github.com/conanjs/agentic-sdlc.git", ref: v1.0.0 }
`;

const localListFile = `schema: components-list/v1
local: true
components:
  - name: agent-knowledge
    source: { type: path, path: ~/workspace/agent-knowledge }
`;

const lockFile = `{
  "components": {
    "agent-knowledge": {
      "build": null,
      "manifest": { "contracts": ["knowledge-provider/v1", "company-kb/v1"], "slot": "knowledge-storage", "version": "1.2.0" },
      "resolved": { "commit": "3f2a9c41d07be85a6c12f4e0b97d3a5c8e61f204" },
      "source": { "ref": "main", "type": "git", "url": "https://github.com/conanjs/agent-knowledge.git" },
      "store_id": "9a41c0d2e7f1"
    },
    "agentic-sdlc": {
      "resolved": { "commit": "9c1d5e7a2b4f60813d9ce5a7b1f20486c3d7e951", "tag": "v1.0.0" },
      "source": { "ref": "v1.0.0", "type": "git", "url": "https://github.com/conanjs/agentic-sdlc.git" }
    }
  },
  "schema": "components-lock/v1"
}
`;

/** Replaces the first `from` in `text` with `to`; fails the test when `from` is not there, so a row cannot pass by accident. */
function change(text: string, from: string, to: string): string {
  if (!text.includes(from)) throw new Error(`the valid file has no "${from}"`);
  return text.replace(from, to);
}

function errorsOf(id: string, text: string): readonly Finding[] {
  return readContract(id, text).errors;
}

describe('AC-1.2 the valid files read with nothing to report', () => {
  it.each([
    ['slots/v1', slotsFile],
    ['component/v1', componentFile],
    ['components-list/v1', listFile],
    ['components-list/v1', localListFile],
    ['components-lock/v1', lockFile],
  ])('%s', (id, text) => {
    expect(readContract(id, text)).toEqual({ errors: [], warnings: [] });
  });

  it('reading the same text twice gives equal results', () => {
    expect(readContract('component/v1', componentFile)).toEqual(readContract('component/v1', componentFile));
  });
});

describe('AC-1.2 an unknown key warns and the file stays valid (CON-10)', () => {
  it.each([
    ['component/v1', componentFile, 'schema: component/v1', 'schema: component/v1\ncolour: blue', 'colour'],
    ['component/v1', componentFile, 'pin: 1', 'pin: 1\n  extra: x', 'contracts.extra'],
    ['component/v1', componentFile, '  index: index.md', '  index: index.md\n  flavour: x', 'provides.flavour'],
    ['slots/v1', slotsFile, 'reserved: true', 'reserved: true\n    colour: blue', 'slots[0].colour'],
    ['components-list/v1', listFile, 'local: false', 'local: false\ncolour: blue', 'colour'],
    ['components-lock/v1', lockFile, '"schema"', '"colour": "blue",\n  "schema"', 'colour'],
  ])('%s: a key at %s', (id, text, from, to, field) => {
    expect(readContract(id, change(text, from, to))).toEqual({
      errors: [],
      warnings: [{ field, message: expect.stringContaining('ignored') as string }],
    });
  });
});

describe('M-03 ids match ^[a-z0-9][a-z0-9-]{0,63}$ (FR-004)', () => {
  const sixtyFour = 'a'.repeat(64);
  it.each([
    ['name', 'name: agentic-sdlc', 'name: Bad_Name'],
    ['name', 'name: agentic-sdlc', `name: ${sixtyFour}a`],
    ['name', 'name: agentic-sdlc', 'name: -leading'],
    ['name', 'name: agentic-sdlc', 'name: has space'],
    ['name', 'name: agentic-sdlc', 'name: UPPER'],
    ['name', 'name: agentic-sdlc', 'name: ""'],
    ['name', 'name: agentic-sdlc', 'name: 12'],
    ['slot', 'slot: framework', 'slot: Framework'],
    ['routes[0].id', '- id: agentic-sdlc', '- id: Not Valid'],
    ['depends.slots[0].slot', '- slot: knowledge-storage', '- slot: Knowledge'],
  ])('a component with a bad id at %s fails naming the field (%s -> %s)', (field, from, to) => {
    const found = errorsOf('component/v1', change(componentFile, from, to));
    expect(found.map((finding) => finding.field)).toContain(field);
  });

  it.each([
    ['a 64 character id', sixtyFour],
    ['an id that starts with a digit', '9lives'],
    ['an id with hyphens', 'a-b-c'],
  ])('%s is accepted', (_label, id) => {
    expect(errorsOf('component/v1', change(componentFile, 'name: agentic-sdlc', `name: ${id}`))).toEqual([]);
  });

  it('a hook id and an event outside the list are errors naming the fields', () => {
    const withHook = change(componentFile, 'hooks: []', 'hooks:\n  - { id: Bad Hook, event: sometime, command: x }');
    expect(errorsOf('component/v1', withHook).map((finding) => finding.field)).toEqual([
      'hooks[0].id',
      'hooks[0].event',
    ]);
  });

  it('a slot name, a location name and a list entry name with a bad id fail', () => {
    expect(
      errorsOf('slots/v1', change(slotsFile, 'name: knowledge-storage', 'name: Knowledge')).map((f) => f.field),
    ).toEqual(['slots[1].name']);
    expect(errorsOf('slots/v1', change(slotsFile, '{ name: content,', '{ name: Content,')).map((f) => f.field)).toEqual(
      ['slots[1].locations[0].name'],
    );
    expect(
      errorsOf('components-list/v1', change(listFile, 'name: agent-knowledge', 'name: Agent_Knowledge')).map(
        (f) => f.field,
      ),
    ).toEqual(['components[0].name']);
  });

  it('a component key of the lock that is not an id fails', () => {
    expect(
      errorsOf('components-lock/v1', change(lockFile, '"agent-knowledge"', '"Agent Knowledge"')).map((f) => f.field),
    ).toEqual(['components.Agent Knowledge']);
  });
});

describe('M-03 path fields are relative with no .., drive letter, backslash or NUL (FR-005)', () => {
  const where = [
    ['locations.framework', 'framework: .', (value: string) => `framework: ${value}`],
    ['provides.index', 'index: index.md', (value: string) => `index: ${value}`],
    ['provides.skills', 'skills: skills/', (value: string) => `skills: ${value}`],
    ['provides.agents', 'agents: agents/', (value: string) => `agents: ${value}`],
    ['routes[0].read', 'read: frameworks/agentic-sdlc/index.md', (value: string) => `read: ${value}`],
    ['provides.exports[0]', 'exports: []', (value: string) => `exports: [${value}]`],
    ['depends.slots[0].docs[0]', 'docs: []', (value: string) => `docs: [${value}]`],
  ] as const;
  const bad = [
    ['a .. segment', '"../escape"'],
    ['a .. segment in the middle', '"a/../../b"'],
    ['a drive letter', '"C:/Users/x"'],
    ['a lowercase drive letter', '"c:foo"'],
    ['a backslash', "'a\\b'"],
    ['a NUL character', '"a\\0b"'],
    ['an absolute path', '/etc/passwd'],
    ['an empty path', '""'],
  ] as const;

  it.each(
    where.flatMap(([field, from, make]) => bad.map(([label, value]) => [field, label, from, make(value)] as const)),
  )('%s with %s fails naming the field', (field, _label, from, to) => {
    const found = errorsOf('component/v1', change(componentFile, from, to));
    expect(found.map((finding) => finding.field)).toContain(field);
    expect(found.every((finding) => finding.message.length > 0)).toBe(true);
  });

  it.each([['.'], ['a/b'], ['a b.md'], ['..hidden'], ['a..b'], ['./x']])('the path %s is accepted', (value) => {
    expect(errorsOf('component/v1', change(componentFile, 'framework: .', `framework: "${value}"`))).toEqual([]);
  });

  it('a mount of a slot is a path too, and {component} is allowed in it', () => {
    expect(
      errorsOf('slots/v1', change(slotsFile, 'mount: knowledge,', 'mount: "../knowledge",')).map((f) => f.field),
    ).toEqual(['slots[1].locations[0].mount']);
    expect(errorsOf('slots/v1', slotsFile)).toEqual([]);
  });

  it("a path source of a list is V's own path: it may be absolute or start with ~", () => {
    expect(errorsOf('components-list/v1', localListFile)).toEqual([]);
    expect(errorsOf('components-list/v1', change(localListFile, '~/workspace/agent-knowledge', '/opt/kb'))).toEqual([]);
  });
});

describe('M-07 and A-23 the repository is a GitHub address with no user-info part', () => {
  const address = 'https://github.com/conanjs/agentic-sdlc';
  it.each([
    ['another host', 'https://gitlab.com/conanjs/agentic-sdlc'],
    ['a host that starts with github.com', 'https://github.com.evil.example/x/y'],
    ['a host that ends with github.com', 'https://evilgithub.com/x/y'],
    ['a user name and password', 'https://user:secret@github.com/conanjs/agentic-sdlc'],
    ['a token as the user name', 'https://ghp_TOKEN@github.com/conanjs/agentic-sdlc'],
    ['http', 'http://github.com/conanjs/agentic-sdlc'],
    ['ssh', 'ssh://git@github.com/conanjs/agentic-sdlc'],
    ['a port', 'https://github.com:8443/conanjs/agentic-sdlc'],
    ['no repository part', 'https://github.com/conanjs'],
    ['too many parts', 'https://github.com/conanjs/agentic-sdlc/tree/main'],
    ['a query', 'https://github.com/conanjs/agentic-sdlc?token=abc'],
    ['text that is no address', 'conanjs/agentic-sdlc'],
  ])('%s fails naming repository, and the message repeats no part of the value', (_label, value) => {
    const found = errorsOf('component/v1', change(componentFile, address, value));
    expect(found.map((finding) => finding.field)).toEqual(['repository']);
    expect(found[0]?.message).toContain('github.com');
    expect(found[0]?.message).not.toMatch(/secret|ghp_|abc|evil/);
  });

  it.each([['https://github.com/other-owner/other-repo'], ['https://github.com/o/r.git']])('%s passes', (value) => {
    expect(errorsOf('component/v1', change(componentFile, address, value))).toEqual([]);
  });

  it('CM-4: provides.exports that is not empty needs a repository', () => {
    const exporting = change(componentFile, 'exports: []', 'exports: [frameworks/agentic-sdlc/index.md]');
    expect(errorsOf('component/v1', exporting)).toEqual([]);
    const withoutRepository = change(exporting, `repository: ${address}\n`, '');
    expect(errorsOf('component/v1', withoutRepository).map((finding) => finding.field)).toEqual(['repository']);
    expect(errorsOf('component/v1', change(componentFile, `repository: ${address}\n`, ''))).toEqual([]);
  });
});

describe('AC-1.3 the old slot keys fail naming the replacement', () => {
  it.each([
    [
      'count',
      'name: knowledge-storage',
      'name: knowledge-storage\n    count: 0..1',
      '`count` is now `required` + `multiple`',
    ],
    ['mounts', 'locations:', 'mounts:', '`mounts` is now `locations`'],
  ])('%s', (key, from, to, message) => {
    const found = errorsOf('slots/v1', change(slotsFile, from, to));
    expect(found).toContainEqual(expect.objectContaining({ message }));
    expect(found.some((finding) => finding.field.endsWith(`.${key}`))).toBe(true);
  });

  it('a slot that has both old keys reports both, each once', () => {
    const both = change(
      slotsFile,
      'name: knowledge-storage',
      'name: knowledge-storage\n    count: 0..1\n    mounts: x',
    );
    const messages = errorsOf('slots/v1', both).map((finding) => finding.message);
    expect(messages.filter((message) => message.startsWith('`count`'))).toHaveLength(1);
    expect(messages.filter((message) => message.startsWith('`mounts`'))).toHaveLength(1);
  });
});

describe('AC-1.4 a slot', () => {
  it('whose contract is a list of two contracts validates, and a one-entry list too', () => {
    expect(
      errorsOf(
        'slots/v1',
        change(slotsFile, 'contract: knowledge-provider/v1', 'contract: [knowledge-provider/v1, company-kb/v1]'),
      ),
    ).toEqual([]);
    expect(
      errorsOf('slots/v1', change(slotsFile, 'contract: knowledge-provider/v1', 'contract: [knowledge-provider/v1]')),
    ).toEqual([]);
  });

  it.each([
    ['an empty list', 'contract: []', 'slots[1].contract'],
    ['a contract name without a major', 'contract: knowledge-provider', 'slots[1].contract'],
    ['a major of 0', 'contract: knowledge-provider/v0', 'slots[1].contract'],
    ['a list with a bad entry', 'contract: [knowledge-provider/v1, Nope]', 'slots[1].contract'],
  ])('with %s fails', (_label, to, field) => {
    const found = errorsOf('slots/v1', change(slotsFile, 'contract: knowledge-provider/v1', to));
    expect(found.map((finding) => finding.field)).toEqual([field]);
  });

  it.each([
    [
      'no required',
      '    required: false\n    multiple: false\n    scope: global\n    self-contained',
      '    multiple: false\n    scope: global\n    self-contained',
      'slots[1].required',
    ],
    ['a scope outside the list', 'scope: per-project', 'scope: project', 'slots[3].scope'],
    [
      'required as text',
      'required: true\n    multiple: false\n    scope: global\n    locations:\n      - { name: core',
      'required: "yes"\n    multiple: false\n    scope: global\n    locations:\n      - { name: core',
      'slots[0].required',
    ],
  ])('with %s fails naming the field', (_label, from, to, field) => {
    expect(errorsOf('slots/v1', change(slotsFile, from, to)).map((finding) => finding.field)).toEqual([field]);
  });

  it('with no locations fails; a slot list that is empty fails', () => {
    expect(errorsOf('slots/v1', 'schema: slots/v1\nslots: []').map((f) => f.field)).toEqual(['slots']);
    expect(errorsOf('slots/v1', 'schema: slots/v1').map((f) => f.field)).toEqual(['slots']);
  });
});

describe('FR-004 the component fields', () => {
  it.each([
    ['name', 'name: agentic-sdlc\n', ''],
    ['version', 'version: 1.4.0\n', ''],
    ['slot', 'slot: framework\n', ''],
    ['contracts', 'contracts:\n  pin: 1\n', ''],
    ['contracts.pin', '  pin: 1\n', '  other: 1\n'],
    ['locations', 'locations:\n  framework: .\n', ''],
  ])('%s is required', (field, from, to) => {
    expect(errorsOf('component/v1', change(componentFile, from, to)).map((finding) => finding.field)).toContain(field);
  });

  it.each([
    ['version', 'version: 1.4.0', 'version: one'],
    ['version', 'version: 1.4.0', 'version: 1.4'],
    ['contracts.pin', 'pin: 1', 'pin: "1"'],
    ['contracts.pin', 'pin: 1', 'pin: 0'],
    ['scope', 'scope: per-project', 'scope: everywhere'],
    ['idle-cost.codex', 'codex: 0', 'codex: -1'],
    ['variables[0].name', 'name: REFERENCE_REPOS_ROOT', 'name: reference_repos_root'],
    ['variables[0].required', 'required: false\n', 'required: maybe\n'],
    ['depends.runtime.node', 'node: ">=24.12"', 'node: 24'],
    ['routes[0].when', 'when: The project has a .specify/ folder', 'when: [x]'],
  ])('a bad %s fails naming it (%s)', (field, from, to) => {
    expect(errorsOf('component/v1', change(componentFile, from, to)).map((finding) => finding.field)).toContain(field);
  });

  it.each([
    ['an env probe', '{ kind: env, name: HOME }', []],
    ['a dir-exists probe', '{ kind: dir-exists, candidates: ["~/ref"] }', []],
    ['a command, which has no form (CM-7, M-18)', '{ kind: command, run: ls }', ['variables[0].detect.kind']],
    [
      'a dir-exists probe with no candidates',
      '{ kind: dir-exists, candidates: [] }',
      ['variables[0].detect.candidates'],
    ],
  ])('variables detect with %s', (_label, detect, fields) => {
    const withDetect = change(componentFile, 'description: Folder', `detect: ${detect}\n    description: Folder`);
    expect(errorsOf('component/v1', withDetect).map((finding) => finding.field)).toEqual(fields);
  });
});

describe('FR-004 the component lists and the lock', () => {
  it.each([
    ['an unknown source type', listFile, 'type: git, url', 'type: svn, url', 'components[0].source.type'],
    ['a git source with no ref', listFile, ', ref: main', '', 'components[0].source.ref'],
    ['a ref that starts with - (M-05)', listFile, 'ref: main', 'ref: --upload-pack=x', 'components[0].source.ref'],
    [
      'a git url with an ftp scheme',
      listFile,
      'https://github.com/conanjs/agent-knowledge.git',
      'ftp://example.com/x.git',
      'components[0].source.url',
    ],
    [
      'a git url that is a scp-style address',
      listFile,
      'https://github.com/conanjs/agent-knowledge.git',
      'git@github.com:o/r.git',
      'components[0].source.url',
    ],
    [
      'a git url that starts with - (M-05)',
      listFile,
      'https://github.com/conanjs/agent-knowledge.git',
      '-oProxyCommand=x',
      'components[0].source.url',
    ],
    [
      'a git url with user and password (M-07)',
      listFile,
      'https://github.com/conanjs/agent-knowledge.git',
      'https://u:pw@github.com/o/r.git',
      'components[0].source.url',
    ],
    [
      'a git url over https with a token as user (M-07)',
      listFile,
      'https://github.com/conanjs/agent-knowledge.git',
      'https://TOKEN@github.com/o/r.git',
      'components[0].source.url',
    ],
    [
      'an ssh url with a password (M-07)',
      listFile,
      'https://github.com/conanjs/agent-knowledge.git',
      'ssh://git:pw@github.com/o/r.git',
      'components[0].source.url',
    ],
    ['no local flag', listFile, 'local: false\n', '', 'local'],
    [
      'a path source with no path',
      localListFile,
      '{ type: path, path: ~/workspace/agent-knowledge }',
      '{ type: path }',
      'components[0].source.path',
    ],
  ])('%s fails naming the field', (_label, text, from, to, field) => {
    const found = errorsOf('components-list/v1', change(text, from, to));
    expect(found.map((finding) => finding.field)).toContain(field);
    expect(found.map((finding) => finding.message).join('\n')).not.toMatch(/pw|TOKEN/);
  });

  it.each([
    ['an ssh url with a user name', 'ssh://git@github.com/o/r.git'],
    ['an https url', 'https://example.com/o/r.git'],
  ])('%s is accepted', (_label, url) => {
    expect(
      errorsOf('components-list/v1', change(listFile, 'https://github.com/conanjs/agent-knowledge.git', url)),
    ).toEqual([]);
  });

  it('an archive source needs an https url and a sha256 of 64 lowercase hexadecimal characters (M-05)', () => {
    const sha = 'ab'.repeat(32);
    const archive = (hash: string): string =>
      `schema: components-list/v1\nlocal: true\ncomponents:\n  - name: my-notes\n    source: { type: archive, url: https://example.invalid/n.tgz, sha256: ${hash} }`;
    expect(errorsOf('components-list/v1', archive(sha))).toEqual([]);
    for (const bad of ['abc', '…', sha.toUpperCase(), `${sha}0`]) {
      expect(errorsOf('components-list/v1', archive(bad)).map((f) => f.field)).toEqual(['components[0].source.sha256']);
    }
  });

  it.each([
    [
      'a commit that is not 40 hex characters',
      '3f2a9c41d07be85a6c12f4e0b97d3a5c8e61f204',
      '3f2a',
      'components.agent-knowledge.resolved.commit',
    ],
    ['a store id that is not 12 hex characters', '9a41c0d2e7f1', 'xyz', 'components.agent-knowledge.store_id'],
    [
      'a build with no source_sha',
      '"build": null',
      '"build": { "build": 1, "adapters": {} }',
      'components.agent-knowledge.build.source_sha',
    ],
    [
      'a resolved with nothing to say where it is',
      '"resolved": { "commit": "9c1d5e7a2b4f60813d9ce5a7b1f20486c3d7e951", "tag": "v1.0.0" }',
      '"resolved": { "tag": "v1.0.0" }',
      'components.agentic-sdlc.resolved',
    ],
  ])('the lock with %s fails naming the field', (_label, from, to, field) => {
    expect(errorsOf('components-lock/v1', change(lockFile, from, to)).map((finding) => finding.field)).toEqual([field]);
  });

  it('a lock entry for a path source holds live and the absolute path', () => {
    const live = change(
      lockFile,
      '"resolved": { "commit": "9c1d5e7a2b4f60813d9ce5a7b1f20486c3d7e951", "tag": "v1.0.0" }',
      '"resolved": { "live": true, "path": "/opt/sdlc" }',
    );
    expect(errorsOf('components-lock/v1', live)).toEqual([]);
  });
});

describe('FR-005 the schema key picks the contract and the major', () => {
  it.each([
    ['is missing', 'schema: component/v1\n', ''],
    ['names another contract', 'schema: component/v1', 'schema: slots/v1'],
    ['has no major', 'schema: component/v1', 'schema: component'],
    ['is a major this reader does not read', 'schema: component/v1', 'schema: component/v2'],
    ['is the major before the first', 'schema: component/v1', 'schema: component/v0'],
    ['is not text', 'schema: component/v1', 'schema: 1'],
  ])('a schema that %s fails naming schema and nothing else', (_label, from, to) => {
    const found = errorsOf('component/v1', change(componentFile, from, to));
    expect(found.map((finding) => finding.field)).toEqual(['schema']);
  });

  it('the message for an unsupported major names the majors the reader reads', () => {
    expect(
      errorsOf('component/v1', change(componentFile, 'schema: component/v1', 'schema: component/v2'))[0]?.message,
    ).toContain('v1');
  });

  it.each([
    [1, [1], [1]],
    [2, [1, 2], [2, 1]],
    [2, [2], [2]],
    [3, [1, 2], [2]],
    [3, [1], []],
    [1, [2], []],
  ])('readableMajors(%i, %j) is %j: the current and the previous major', (requested, known, expected) => {
    expect(readableMajors(requested, known)).toEqual(expected);
  });

  it('a reader asked for the next major still accepts a file of the previous one', () => {
    expect(readContract('component/v2', componentFile)).toEqual({ errors: [], warnings: [] });
    expect(readContract('component/v3', componentFile).errors.map((finding) => finding.field)).toEqual(['schema']);
  });
});

describe('FR-005 a contract the reader does not know', () => {
  it.each([['nope/v1'], ['component'], ['component/v0'], ['Component/v1'], [''], ['__proto__/v1'], ['constructor/v1']])(
    '%j is an error naming id',
    (id) => {
      expect(readContract(id, componentFile).errors.map((finding) => finding.field)).toEqual(['id']);
    },
  );
});

describe('M-17 the limits of the YAML wrapper reach the reader', () => {
  it.each([
    ['an alias', 'a: &x 1\nb: *x\n', 'ALIAS_REFUSED'],
    ['a custom tag', 'a: !foo 1\n', 'TAG_RESOLVE_FAILED'],
    ['a !!binary tag', 'a: !!binary aGk=\n', 'TAG_RESOLVE_FAILED'],
    ['a second document', 'a: 1\n---\nb: 2\n', 'MULTIPLE_DOCS'],
    ['a duplicate key', 'a: 1\na: 2\n', 'DUPLICATE_KEY'],
    ['a text over 256 KiB', `a: ${'x'.repeat(MAX_YAML_BYTES)}\n`, 'TOO_LARGE'],
    ['nesting too deep', '['.repeat(2_000), 'RESOURCE_EXHAUSTION'],
  ])('%s is refused with a finding on (document) that carries the code', (_label, text, code) => {
    const found = errorsOf('component/v1', text);
    expect(found.length).toBeGreaterThan(0);
    expect(found.every((finding) => finding.field === '(document)')).toBe(true);
    expect(found.map((finding) => finding.message).join('\n')).toContain(code);
  });

  it.each([
    ['an empty file', ''],
    ['a list', '- a\n- b\n'],
    ['a single value', 'hello\n'],
  ])('%s is not a mapping', (_label, text) => {
    expect(errorsOf('component/v1', text)).toEqual([
      { field: '(document)', message: expect.stringContaining('mapping') as string },
    ]);
  });

  it.each([
    ['JSON that is cut off', '{ "schema": "components-lock/v1", "components": '],
    ['text that is not JSON', 'schema: components-lock/v1'],
    ['nesting too deep', '['.repeat(200_000)],
  ])('a lock with %s is one error and repeats none of the text', (_label, text) => {
    const found = errorsOf('components-lock/v1', text);
    expect(found).toHaveLength(1);
    expect(found[0]?.field).toBe('(document)');
    expect(found[0]?.message).not.toContain('schema: components');
  });

  it('a lock over 256 KiB is refused', () => {
    expect(errorsOf('components-lock/v1', `{"x": "${'x'.repeat(MAX_YAML_BYTES)}"}`)[0]?.message).toContain('TOO_LARGE');
  });

  it('a lock with a key __proto__ reads as an ordinary unknown key and pollutes nothing', () => {
    const polluted = change(lockFile, '"schema"', '"__proto__": { "polluted": true },\n  "schema"');
    const result = readContract('components-lock/v1', polluted);
    expect(result.errors).toEqual([]);
    expect(result.warnings.map((finding) => finding.field)).toEqual(['__proto__']);
    expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
  });
});

describe('FR-005 every finding names a field and says something, and an error never shows a secret', () => {
  it('over all the negative rows above the shape of a finding is the same', () => {
    const found = [
      ...errorsOf('component/v1', change(componentFile, 'name: agentic-sdlc', 'name: Bad_Name')),
      ...errorsOf('slots/v1', change(slotsFile, 'name: knowledge-storage', 'name: knowledge-storage\n    count: 0..1')),
      ...errorsOf('components-lock/v1', '{'),
    ];
    for (const finding of found) {
      expect(Object.keys(finding).sort()).toEqual(['field', 'message']);
      expect(finding.field).not.toBe('');
    }
  });
});

describe('M-07 and M-05 the probe addresses are refused wherever they are written', () => {
  const probes = [
    ['a backslash hides the real host (token)', 'https://tok\\@127.0.0.1:9/o/r'],
    ['a backslash hides the real host (github.com)', 'https://github.com\\@evil.com/o'],
    ['backslashes for slashes', 'https:\\\\github.com\\o\\r'],
    ['a tab inside the host', 'https://git\thub.com/o/r'],
    ['a NUL before the scheme', '\u0000https://github.com/o/r'],
    ['an encoded line break at the end', 'https://github.com/o/r%0a'],
    ['an encoded slash after dots', 'https://github.com/o/..%2fx'],
    ['a line break then an option', 'https://github.com/o/r\n--upload-pack=x'],
    ['a token in the query', 'https://github.com/o/r?access_token=ghp_x'],
    ['an ssh host that is an option', 'ssh://-oProxyCommand=x/r'],
  ] as const;

  it.each(probes)('repository: %s', (_label, value) => {
    const found = errorsOf(
      'component/v1',
      change(
        componentFile,
        'repository: https://github.com/conanjs/agentic-sdlc',
        `repository: ${JSON.stringify(value)}`,
      ),
    );
    expect(found.map((finding) => finding.field)).toEqual(['repository']);
    expect(JSON.stringify(found)).not.toMatch(/ghp_x|upload-pack|127\.0\.0\.1|evil|tok/);
  });

  it.each(probes)('list source url: %s', (_label, value) => {
    const found = errorsOf(
      'components-list/v1',
      change(listFile, '"https://github.com/conanjs/agent-knowledge.git"', JSON.stringify(value)),
    );
    expect(found.map((finding) => finding.field)).toEqual(['components[0].source.url']);
    expect(JSON.stringify(found)).not.toMatch(/ghp_x|upload-pack|127\.0\.0\.1|evil|tok/);
  });

  it('an address that the parser would write differently is refused: upper case host, default port, dot segment', () => {
    for (const value of ['https://GitHub.com/o/r', 'https://github.com:443/o/r', 'https://github.com/o/./r']) {
      const found = errorsOf('component/v1', change(componentFile, 'https://github.com/conanjs/agentic-sdlc', value));
      expect(found.map((finding) => finding.field)).toEqual(['repository']);
    }
  });

  it('owner and repository segments follow the GitHub allow-list', () => {
    for (const value of [
      `https://github.com/${'a'.repeat(40)}/r`,
      'https://github.com/o/r r',
      'https://github.com/o/r/',
    ]) {
      expect(
        errorsOf('component/v1', change(componentFile, 'https://github.com/conanjs/agentic-sdlc', value)).length,
      ).toBeGreaterThan(0);
    }
    expect(
      errorsOf(
        'component/v1',
        change(
          componentFile,
          'https://github.com/conanjs/agentic-sdlc',
          `https://github.com/${'a'.repeat(39)}/${'b'.repeat(100)}`,
        ),
      ),
    ).toEqual([]);
  });

  it('a list source url with a query or a fragment is refused (M-07)', () => {
    for (const tail of ['?token=abc', '#frag']) {
      const found = errorsOf(
        'components-list/v1',
        change(listFile, 'agent-knowledge.git', `agent-knowledge.git${tail}`),
      );
      expect(found.map((f) => f.field)).toEqual(['components[0].source.url']);
    }
  });
});

describe('M-03 more path rules: segments ending in a dot or a space, and any colon', () => {
  it.each([
    ['a segment ending in a dot', 'a./b'],
    ['a last segment ending in a dot', 'a/b.'],
    ['a segment ending in a space', 'a /b'],
    ['a colon in the middle', 'a:b'],
    ['an alternate data stream', 'file.md:stream'],
  ])('%s fails', (_label, value) => {
    const found = errorsOf(
      'component/v1',
      change(componentFile, 'framework: .', `framework: ${JSON.stringify(value)}`),
    );
    expect(found.map((finding) => finding.field)).toEqual(['locations.framework']);
  });
});

describe('M-18 and CM-6 detect candidates start with ~/, and a suggested source is never a local path', () => {
  const withCandidates = (value: string): string =>
    change(
      componentFile,
      'description: Folder',
      `detect: { kind: dir-exists, candidates: [${value}] }\n    description: Folder`,
    );

  it.each([
    ['~/ref', []],
    ['"~/a/b"', []],
    ['/etc', ['variables[0].detect.candidates[0]']],
    ['ref', ['variables[0].detect.candidates[0]']],
    ['"~/../x"', ['variables[0].detect.candidates[0]']],
    ['"~/a:b"', ['variables[0].detect.candidates[0]']],
    ['"~"', ['variables[0].detect.candidates[0]']],
    ['"~/"', ['variables[0].detect.candidates[0]']],
  ])('candidate %s', (value, fields) => {
    expect(errorsOf('component/v1', withCandidates(value)).map((finding) => finding.field)).toEqual(fields);
  });

  const withSuggest = (source: string): string =>
    change(componentFile, 'docs: []', `docs: []\n      suggest:\n        source: ${source}`);

  it('a suggested git source reads and a path source is refused', () => {
    expect(errorsOf('component/v1', withSuggest('{ type: git, url: https://github.com/o/r.git, ref: main }'))).toEqual(
      [],
    );
    const found = errorsOf('component/v1', withSuggest('{ type: path, path: /home/v/secret }'));
    expect(found.map((finding) => finding.field)).toEqual(['depends.slots[0].suggest.source.type']);
  });
});

describe('M-05 the lock: tag follows the ref rule, hashes are 64 hexadecimal characters, resolved says where', () => {
  const commit = '9c1d5e7a2b4f60813d9ce5a7b1f20486c3d7e951';
  const resolvedAs = (value: string): string =>
    change(lockFile, `"resolved": { "commit": "${commit}", "tag": "v1.0.0" }`, `"resolved": ${value}`);

  it.each([
    [
      'a tag that starts with -',
      `{ "commit": "${commit}", "tag": "--upload-pack=x" }`,
      ['components.agentic-sdlc.resolved.tag'],
    ],
    ['a tag with a space', `{ "commit": "${commit}", "tag": "v 1" }`, ['components.agentic-sdlc.resolved.tag']],
    ['a short sha256', '{ "sha256": "abc" }', ['components.agentic-sdlc.resolved.sha256']],
    ['live: false', '{ "live": false, "path": "/opt/x" }', ['components.agentic-sdlc.resolved']],
    ['live without a path', '{ "live": true }', ['components.agentic-sdlc.resolved']],
    ['a path without live', '{ "path": "/opt/x" }', ['components.agentic-sdlc.resolved']],
    ['an empty mapping', '{}', ['components.agentic-sdlc.resolved']],
    ['live: true with a path', '{ "live": true, "path": "/opt/x" }', []],
    ['a sha256 of 64 characters', `{ "sha256": "${'0f'.repeat(32)}" }`, []],
  ])('resolved with %s', (_label, value, fields) => {
    expect(errorsOf('components-lock/v1', resolvedAs(value)).map((finding) => finding.field)).toEqual(fields);
  });
});

describe('Q-SEC-9 findings are capped at 50 of each kind with one more line', () => {
  it('a list of 200 bad entries gives 50 errors and one "more not shown" line', () => {
    const entries = Array.from({ length: 200 }, () => '  - name: Bad_Name\n    source: { type: path, path: /x }').join(
      '\n',
    );
    const found = errorsOf('components-list/v1', `schema: components-list/v1\nlocal: true\ncomponents:\n${entries}`);
    expect(found).toHaveLength(51);
    expect(found[50]).toEqual({ field: '(document)', message: '150 more not shown' });
  });

  it('the warnings are capped the same way', () => {
    const extra = Array.from({ length: 120 }, (_, index) => `k${index}: 1`).join('\n');
    const result = readContract('components-list/v1', `${listFile}${extra}\n`);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toHaveLength(51);
    expect(result.warnings[50]?.message).toBe('70 more not shown');
  });

  it('exactly 50 are shown whole', () => {
    const extra = Array.from({ length: 50 }, (_, index) => `k${index}: 1`).join('\n');
    expect(readContract('components-list/v1', `${listFile}${extra}\n`).warnings).toHaveLength(50);
  });
});

describe('FR-004 local is required in a components list, as in both shipped examples', () => {
  it('a list without local fails naming it', () => {
    expect(errorsOf('components-list/v1', change(localListFile, 'local: true\n', '')).map((f) => f.field)).toEqual([
      'local',
    ]);
  });
});

describe('M-07, M-05 and A-23 second review: encoded user-info, owner and repository names, empty query and fragment', () => {
  const sourceProbes = [
    'ssh://git%3apw@host/o/r',
    'ssh://%2doProxyCommand=false/r',
    'ssh://git@ho%73t/o/r',
    'ssh://us er@host/o/r',
    'ssh://u$er@host/o/r',
    'ssh://git@-host/o/r',
    'ssh://git@host_name/o/r',
    'https://example.com/o/r%3Fx',
    'https://example.com/o/r%23x',
    'https://example.com/o/r?',
    'https://example.com/o/r#',
  ];
  it.each(sourceProbes)('list source url %s is refused', (value) => {
    const found = errorsOf(
      'components-list/v1',
      change(listFile, '"https://github.com/conanjs/agent-knowledge.git"', JSON.stringify(value)),
    );
    expect(found.map((finding) => finding.field)).toEqual(['components[0].source.url']);
    expect(JSON.stringify(found)).not.toMatch(/pw|ProxyCommand/);
  });

  it.each([
    'ssh://git@github.com/o/r.git',
    'ssh://deploy-1.x_y@git.example.com:2222/o/r.git',
    'https://git.example.com/o/r',
  ])('list source url %s is accepted', (value) => {
    const found = errorsOf(
      'components-list/v1',
      change(listFile, 'https://github.com/conanjs/agent-knowledge.git', value),
    );
    expect(found).toEqual([]);
  });

  it.each([
    'https://github.com/-/r',
    'https://github.com/-o/r',
    'https://github.com/o/.git',
    'https://github.com/o/.',
    'https://github.com/o/..',
    'https://github.com/o/r?',
    'https://github.com/o/r#',
    'https://github.com/o/r%3Fx',
    'https://github.com/o/r%23x',
  ])('repository %s is refused', (value) => {
    const found = errorsOf('component/v1', change(componentFile, 'https://github.com/conanjs/agentic-sdlc', value));
    expect(found.map((finding) => finding.field)).toEqual(['repository']);
  });

  it.each(['https://github.com/o/.github', 'https://github.com/0/r.git', 'https://github.com/o/a.b_c-d'])(
    'repository %s is accepted',
    (value) => {
      expect(errorsOf('component/v1', change(componentFile, 'https://github.com/conanjs/agentic-sdlc', value))).toEqual(
        [],
      );
    },
  );
});
