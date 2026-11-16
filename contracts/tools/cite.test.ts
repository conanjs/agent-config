// Tests of the cite subcommand (specs/022 T100): the plan in memory, the text edit of depends.docs and the command on a folder.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { LocationRule } from '#contracts/lib/citations.ts';
import { formatCite, planCite, runCite, type CiteInput, type Provider } from './cite.ts';
import type { ToolEnv } from './tool-io.ts';

const rules: readonly LocationRule[] = [
  { slot: 'knowledge-storage', location: 'content', mount: 'knowledge' },
  { slot: 'knowledge-storage', location: 'framework', mount: 'frameworks/knowledge' },
  { slot: 'framework', location: 'framework', mount: 'frameworks/{component}' },
];

const knowledge: Provider = {
  file: 'k/component.yaml',
  name: 'agent-knowledge',
  slot: 'knowledge-storage',
  repository: 'https://github.com/o/agent-knowledge',
  locations: { content: '.', framework: 'fw dir' },
};

function input(text: string, overrides: Partial<CiteInput> = {}): CiteInput {
  return { rules, providers: [knowledge], files: [{ path: 'a.md', text }], component: undefined, ...overrides };
}

describe('AC-9.5 the target', () => {
  it('is the repository, the main branch, the folder of the location and the path, each segment encoded', () => {
    const plan = planCite(input('[{{AGENT_HOME}}/frameworks/knowledge/a b/é.md]()'), true);
    expect(plan.changes).toEqual([
      {
        path: 'a.md',
        text: '[{{AGENT_HOME}}/frameworks/knowledge/a b/é.md](https://github.com/o/agent-knowledge/blob/main/fw%20dir/a%20b/%C3%A9.md)',
      },
    ]);
    expect(plan.written).toBe(1);
  });

  it('keeps a trailing slash of the repository and a dot folder out of the address', () => {
    const provider = { ...knowledge, repository: 'https://github.com/o/r/' };
    const plan = planCite(input('[{{AGENT_HOME}}/knowledge/x.md]()', { providers: [provider] }), true);
    expect(plan.changes[0]?.text).toContain('(https://github.com/o/r/blob/main/x.md)');
  });

  it('ignores images, bare paths, placeholder paths and a text with other words before the prefix', () => {
    const text =
      '![{{AGENT_HOME}}/knowledge/x.md]() [docs/x.md]() [{{AGENT_HOME}}/companies/<c>/x.md]() [see {{AGENT_HOME}}/knowledge/x.md]()';
    expect(planCite(input(text), false)).toMatchObject({ findings: [], citations: 0 });
  });

  it('allows one level of parentheses in a target and replaces the whole of it', () => {
    const plan = planCite(input('[{{AGENT_HOME}}/knowledge/x.md](https://x/y(1).md) end'), true);
    expect(plan.changes[0]?.text).toBe(
      '[{{AGENT_HOME}}/knowledge/x.md](https://github.com/o/agent-knowledge/blob/main/x.md) end',
    );
  });

  it('picks the framework provider by the component name in the mount', () => {
    const framework: Provider = { ...knowledge, name: 'sdlc', slot: 'framework', locations: { framework: '.' } };
    const plan = planCite(
      input('[{{AGENT_HOME}}/frameworks/sdlc/a.md]() [{{AGENT_HOME}}/frameworks/other/a.md]()', {
        providers: [framework],
      }),
      false,
    );
    expect(plan.findings).toEqual([
      'a.md: error: citation "{{AGENT_HOME}}/frameworks/sdlc/a.md" has no target, expected https://github.com/o/agent-knowledge/blob/main/a.md',
      'a.md: error: citation "{{AGENT_HOME}}/frameworks/other/a.md": no --provider fills slot framework as other',
    ]);
  });
});

describe('AC-9.6, AC-9.7 findings', () => {
  it('names a provider location that does not exist', () => {
    const provider = { ...knowledge, locations: {} };
    expect(planCite(input('[{{AGENT_HOME}}/knowledge/x.md]()', { providers: [provider] }), false).findings).toEqual([
      'a.md: error: citation "{{AGENT_HOME}}/knowledge/x.md": provider agent-knowledge has no location content (k/component.yaml)',
    ]);
  });

  it('keeps a finding no write can fix, and still writes the other fixes of the run', () => {
    const none = { ...knowledge, repository: undefined };
    const plan = planCite(
      input('[{{AGENT_HOME}}/knowledge/x.md]() [{{AGENT_HOME}}/unknown/y.md]()', { providers: [none] }),
      true,
    );
    expect(plan.changes).toEqual([]);
    expect(plan.findings).toEqual([
      'a.md: error: citation "{{AGENT_HOME}}/knowledge/x.md": provider agent-knowledge has no repository (k/component.yaml)',
      'a.md: error: citation "{{AGENT_HOME}}/unknown/y.md": the path "unknown/y.md" is under no slot location',
    ]);
  });

  it('writes nothing without write', () => {
    expect(planCite(input('[{{AGENT_HOME}}/knowledge/x.md]()'), false)).toMatchObject({ changes: [], written: 0 });
  });
});

describe('FR-017 depends.docs', () => {
  const header = 'depends:\n  slots:\n    - slot: knowledge-storage\n      required: true\n';
  const withEntry = (line: string, extra = ''): string => `${header}${line}${extra}`;
  const component = (text: string): CiteInput['component'] => ({
    text,
    entries: [{ slot: 'knowledge-storage', docs: [] }],
  });
  const run = (text: string, write: boolean) =>
    planCite(
      input(
        '[{{AGENT_HOME}}/knowledge/b.md](https://github.com/o/agent-knowledge/blob/main/b.md) [{{AGENT_HOME}}/knowledge/a.md](https://github.com/o/agent-knowledge/blob/main/a.md)',
        {
          component: component(text),
        },
      ),
      write,
    );

  it('replaces a flow list and keeps the comment after it', () => {
    const plan = run(withEntry('      docs: [] # generated\n'), true);
    expect(plan.changes).toEqual([
      { path: 'component.yaml', text: withEntry('      docs: [knowledge/a.md, knowledge/b.md] # generated\n') },
    ]);
  });

  it('adds the line when the entry has none, and replaces an empty value', () => {
    expect(run(header, true).changes[0]?.text).toBe(
      'depends:\n  slots:\n    - slot: knowledge-storage\n      docs: [knowledge/a.md, knowledge/b.md]\n      required: true\n',
    );
    expect(run(withEntry('      docs:\n'), true).changes[0]?.text).toContain(
      'docs: [knowledge/a.md, knowledge/b.md]\n',
    );
  });

  it('says it cannot rewrite a block list and names the value to write by hand', () => {
    const plan = run(withEntry('      docs:\n        - knowledge/a.md\n'), true);
    expect(plan.findings).toEqual([
      'component.yaml: error: depends.slots knowledge-storage: cannot rewrite docs in this layout; write docs: [knowledge/a.md, knowledge/b.md] by hand',
    ]);
    expect(plan.changes).toEqual([]);
  });

  it('reports the written and the generated value without write', () => {
    expect(run(header, false).findings).toEqual([
      'component.yaml: error: depends.slots knowledge-storage docs is [], generated value is [knowledge/a.md, knowledge/b.md]',
    ]);
  });

  it('quotes a doc name that a flow list could not hold', () => {
    const odd = planCite(
      input('[{{AGENT_HOME}}/knowledge/a, b.md](https://github.com/o/agent-knowledge/blob/main/a%2C%20b.md)', {
        component: component(header),
      }),
      true,
    );
    expect(odd.changes[0]?.text).toContain('docs: ["knowledge/a, b.md"]');
  });

  it('keeps CRLF line ends', () => {
    expect(run(header.replaceAll('\n', '\r\n'), true).changes[0]?.text).toContain(
      'docs: [knowledge/a.md, knowledge/b.md]\r\n',
    );
  });
});

describe('the report', () => {
  const plan = { findings: [], citations: 3, changes: [], written: 2 };
  it('words the three endings the scenarios pin', () => {
    expect(formatCite([], plan, false)).toEqual({ code: 0, out: 'cite: 3 citations ok\n', err: '' });
    expect(formatCite([], plan, true)).toEqual({ code: 0, out: 'cite: 3 citations ok, 2 written\n', err: '' });
    expect(formatCite(['x'], plan, true)).toEqual({ code: 1, out: 'x\ncite: 1 findings\n', err: '' });
  });
});

describe('the command', () => {
  const folders: string[] = [];
  afterEach(() => {
    for (const folder of folders.splice(0)) fs.rmSync(folder, { recursive: true, force: true });
  });
  const slotsText =
    'schema: slots/v1\nslots:\n  - name: knowledge-storage\n    contract: knowledge-provider/v1\n    required: false\n    multiple: false\n    scope: global\n    locations:\n      - { name: content, mount: knowledge }\n';
  const providerText =
    'schema: component/v1\nname: k\nversion: 1.0.0\nslot: knowledge-storage\nrepository: https://github.com/o/k\ncontracts:\n  pin: 1\nlocations:\n  content: .\n';

  function folder(files: Readonly<Record<string, string>>): { root: string; env: ToolEnv } {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cite-'));
    folders.push(root);
    for (const [name, text] of Object.entries(files)) {
      fs.mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
      fs.writeFileSync(path.join(root, name), text);
    }
    const env: ToolEnv = {
      cwd: root,
      home: '/h',
      platform: 'linux',
      today: '2026-11-14',
      nodeVersion: '24.12.0',
      gitHead: () => ({ ok: false, message: '' }),
      gitTracked: () => [],
    };
    return { root, env };
  }
  const base = {
    'slots.yaml': slotsText,
    'p/component.yaml': providerText,
    'a.md': '[{{AGENT_HOME}}/knowledge/x.md]()',
  };
  const args = ['--slots', 'slots.yaml', '--provider', 'p/component.yaml'];

  it('writes once and then changes nothing', () => {
    const { root, env } = folder(base);
    expect(runCite(['--write', ...args], env).out).toBe('cite: 1 citations ok, 1 written\n');
    const once = fs.readFileSync(path.join(root, 'a.md'), 'utf8');
    expect(once).toBe('[{{AGENT_HOME}}/knowledge/x.md](https://github.com/o/k/blob/main/x.md)');
    expect(runCite(['--write', ...args], env).out).toBe('cite: 1 citations ok, 0 written\n');
    expect(fs.readFileSync(path.join(root, 'a.md'), 'utf8')).toBe(once);
  });

  it('skips node_modules and .git and reads files in path order', () => {
    const { env } = folder({
      ...base,
      'node_modules/m/z.md': '[{{AGENT_HOME}}/knowledge/z.md]()',
      '.git/z.md': '[{{AGENT_HOME}}/knowledge/z.md]()',
      'b.md': '[{{AGENT_HOME}}/knowledge/y.md]()',
    });
    const out = runCite(args, env).out.split('\n');
    expect(out.slice(0, 2).map((line) => line.split(':')[0])).toEqual(['a.md', 'b.md']);
    expect(out[2]).toBe('cite: 2 findings');
  });

  it('exits 2 for an unknown option, a missing value, a stray argument and a missing --slots or --provider', () => {
    const { env } = folder(base);
    expect(runCite(['--nope'], env)).toMatchObject({ code: 2, err: 'build.ts cite: unknown option --nope\n' });
    expect(runCite(['--slots'], env).err).toBe('build.ts cite: option --slots needs a value\n');
    expect(runCite(['stray'], env).err).toBe('build.ts cite: unexpected argument stray\n');
    expect(runCite(['--provider', 'p/component.yaml'], env).err).toBe('build.ts cite: --slots is required\n');
    expect(runCite(['--slots', 'slots.yaml'], env).err).toBe('build.ts cite: at least one --provider is required\n');
  });

  it('accepts --option=value and reports an unreadable provider as a finding', () => {
    const { env } = folder(base);
    expect(runCite(['--slots=slots.yaml', '--provider=missing.yaml'], env)).toMatchObject({
      code: 1,
      out: expect.stringContaining('missing.yaml: error: cannot read the file') as string,
    });
  });
});
