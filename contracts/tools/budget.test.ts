// Tests of the dry-run baseline (specs/022 T075). Test titles start with the id they prove: AC-1.7 (spec.md), A-28, DR-607.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  buildBaseline,
  importsOf,
  parseMapping,
  resolveImport,
  runBudget,
  sessionFiles,
  type MappingEntry,
  type SourceTree,
} from './budget.ts';
import { fail, succeed, type ToolEnv } from './tool-io.ts';

const mapping: readonly MappingEntry[] = [
  { source: 'copilot/instructions', target: '~/.copilot/instructions' },
  { source: 'claude/CLAUDE.md', target: '~/.claude/CLAUDE.md' },
  { source: 'copilot/instructions/core.md', target: '~/.codex/AGENTS.md' },
  { source: 'skills', target: '~/.claude/skills' },
];

function treeOf(files: Readonly<Record<string, string>>): SourceTree {
  return {
    read: (file) => files[file],
    list: (folder) =>
      Object.keys(files)
        .filter((file) => file.startsWith(`${folder}/`))
        .sort(),
  };
}

const files = {
  'claude/CLAUDE.md': '@~/.copilot/instructions/core.md\nHome: {{AGENT_HOME}}/x.md\n',
  'copilot/instructions/core.md': 'Core {{AGENT_HOME}}/a.md\n',
  'copilot/instructions/extra.md': 'Extra\n',
  'skills/plain/SKILL.md': '---\nname: plain\ndescription: abc\n---\nBody\n',
  'skills/sdlc-one/SKILL.md': '---\nname: sdlc-one\ndescription: "de"\n---\nBody\n',
};
const context = { home: '/h/.agent-config', platform: 'darwin', allowList: [] } as const;
const facts = { nodeVersion: '24.12.0', date: '2026-11-14', commit: 'a'.repeat(40) };

describe('AC-1.7 imports of a Claude Code memory file', () => {
  it('finds an @path import and ignores code spans, fenced code and an e-mail address', () => {
    const text = '@a/b.md\nmail me@example.com\n`@c/d.md` and see @e.md.\n```\n@f/g.md\n```\n';
    expect(importsOf(text)).toEqual(['a/b.md', 'e.md']);
  });

  it('resolves a ~/ import through the longest mapping target, and a relative one from the importing file', () => {
    expect(resolveImport('~/.copilot/instructions/core.md', 'claude/CLAUDE.md', mapping)).toBe(
      'copilot/instructions/core.md',
    );
    expect(resolveImport('./sibling.md', 'claude/CLAUDE.md', mapping)).toBe('claude/sibling.md');
  });

  it.each(['/etc/passwd', '../../outside.md', '~/.unknown/x.md'])('refuses %s', (spec) => {
    expect(resolveImport(spec, 'claude/CLAUDE.md', mapping)).toBeUndefined();
  });
});

describe('AC-1.7 the files an agent loads at session start', () => {
  it('Claude Code loads its memory file, then what it imports', () => {
    const loaded = sessionFiles('claude-code', mapping, treeOf(files));
    expect(loaded.ok && loaded.value.map((file) => file.source)).toEqual([
      'claude/CLAUDE.md',
      'copilot/instructions/core.md',
    ]);
  });

  it('Claude Code loads a file imported twice, or in a cycle, once', () => {
    const cyclic = treeOf({ ...files, 'copilot/instructions/core.md': '@~/.claude/CLAUDE.md\n@~/.claude/CLAUDE.md\n' });
    const loaded = sessionFiles('claude-code', mapping, cyclic);
    expect(loaded.ok && loaded.value).toHaveLength(2);
  });

  it('Copilot CLI loads every file below its instructions folder, Codex only its AGENTS.md', () => {
    const copilot = sessionFiles('copilot-cli', mapping, treeOf(files));
    const codex = sessionFiles('codex', mapping, treeOf(files));
    expect(copilot.ok && copilot.value.map((file) => file.source)).toEqual([
      'copilot/instructions/core.md',
      'copilot/instructions/extra.md',
    ]);
    expect(codex.ok && codex.value.map((file) => file.source)).toEqual(['copilot/instructions/core.md']);
  });

  it('names the file that is missing', () => {
    const loaded = sessionFiles('codex', mapping, treeOf({}));
    expect(loaded).toEqual({ ok: false, message: 'codex: cannot read copilot/instructions/core.md' });
  });
});

describe('AC-1.7 and A-28 the figures', () => {
  it('counts rendered code points, the home lines and the skill list, and rounds the token estimate up', () => {
    const report = buildBaseline({ mapping, tree: treeOf(files), context, ...facts });
    if (!report.ok) throw new Error(report.message);
    const codex = report.value.agents.codex;
    const rendered =
      'Generated from `copilot/instructions/core.md`; edit that file, not this copy.\nCore /h/.agent-config/a.md\n';
    expect(codex.characters).toBe(Array.from(rendered).length);
    expect(codex.tokens_estimate).toBe(Math.ceil(codex.characters / 4));
    expect(codex.agent_home_lines).toBe(1);
    expect(report.value.agents['claude-code'].agent_home_lines).toBe(2);
    expect(report.value.agents['claude-code'].skill_list_characters).toBe('plain'.length + 3 + 'sdlc-one'.length + 2);
    expect(report.value.agents['claude-code'].skill_list_sdlc_characters).toBe('sdlc-one'.length + 2);
    expect(codex.commit).toBe(facts.commit);
  });

  it('refuses a skill with no description, naming its file', () => {
    const broken = treeOf({ ...files, 'skills/bad/SKILL.md': '---\nname: bad\n---\n' });
    expect(buildBaseline({ mapping, tree: broken, context, ...facts })).toEqual({
      ok: false,
      message: 'skills/bad/SKILL.md: the front matter needs a text name and a text description',
    });
  });

  it('reads mapping.yaml and refuses an entry with no target', () => {
    expect(parseMapping('- { source: a, target: ~/b, strategy: symlink }\n').ok).toBe(true);
    expect(parseMapping('- { source: a }\n')).toEqual({
      ok: false,
      message: 'mapping.yaml: entry 1 needs a text `source` and `target`',
    });
  });
});

describe('AC-1.7 the command', () => {
  const folders: string[] = [];
  afterEach(() => {
    for (const folder of folders.splice(0)) fs.rmSync(folder, { recursive: true, force: true });
  });

  function repoOf(): { root: string; env: ToolEnv } {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'budget-'));
    folders.push(root);
    for (const [file, text] of Object.entries(files)) {
      fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
      fs.writeFileSync(path.join(root, file), text);
    }
    const yaml = mapping.map((entry) => `- { source: ${entry.source}, target: ${entry.target}, strategy: symlink }`);
    fs.writeFileSync(path.join(root, 'mapping.yaml'), `${yaml.join('\n')}\n`);
    const env: ToolEnv = {
      cwd: root,
      home: '/h',
      platform: 'darwin',
      today: facts.date,
      nodeVersion: facts.nodeVersion,
      gitHead: () => succeed(facts.commit),
      gitTracked: () => [],
    };
    return { root, env };
  }

  it('prints the report and writes nothing', () => {
    const { root, env } = repoOf();
    const before = fs.readdirSync(root, { recursive: true }).sort();
    const outcome = runBudget(['--baseline'], env);
    expect(outcome.code).toBe(0);
    expect((JSON.parse(outcome.out) as { schema: string }).schema).toBe('build/v1');
    expect(fs.readdirSync(root, { recursive: true }).sort()).toEqual(before);
  });

  it('writes the same report to --out, creating its folder', () => {
    const { root, env } = repoOf();
    const printed = runBudget(['--baseline'], env).out;
    const outcome = runBudget(['--baseline', '--out', 'docs/baselines/x.json'], env);
    expect(outcome).toEqual({ code: 0, out: 'wrote docs/baselines/x.json\n', err: '' });
    expect(fs.readFileSync(path.join(root, 'docs/baselines/x.json'), 'utf8')).toBe(printed);
  });

  it('refuses --out outside the root with exit 2', () => {
    const { env } = repoOf();
    expect(runBudget(['--baseline', '--out', '../escape.json'], env).code).toBe(2);
  });

  it.each([
    [[]],
    [['--baseline', '--platform', 'beos']],
    [['--baseline', '--unknown']],
    [['--baseline', '--out', 'a', '--render', 'b']],
  ])('exits 2 for the wrong command line %j', (argv) => {
    expect(runBudget(argv, repoOf().env).code).toBe(2);
  });

  it('exits 1 and names the cause when git cannot give the commit', () => {
    const { env } = repoOf();
    const outcome = runBudget(['--baseline'], { ...env, gitHead: () => fail('no commit') });
    expect(outcome).toEqual({ code: 1, out: '', err: 'budget: no commit\n' });
  });

  it('DR-607 renders one file with the swap and the generated-from line', () => {
    const { env } = repoOf();
    const outcome = runBudget(['--baseline', '--render', 'claude/CLAUDE.md'], env);
    expect(outcome.out.split('\n').slice(0, 3)).toEqual([
      'Generated from `claude/CLAUDE.md`; edit that file, not this copy.',
      '@/h/.agent-config/instructions/core.md',
      'Home: /h/.agent-config/x.md',
    ]);
  });
});
