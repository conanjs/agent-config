// Tests of the layout check (specs/022 T076): FR-012, AC-16.10. The rules are the contract's own rules.yaml.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  RULES_FILE,
  checkLayout,
  formatFindings,
  parseRules,
  runLayout,
  type LayoutRules,
  type RepoView,
} from './layout.ts';
import type { ToolEnv } from './tool-io.ts';

const rulesText = fs.readFileSync(RULES_FILE, 'utf8');
const parsed = parseRules(rulesText);
if (!parsed.ok) throw new Error(parsed.message);
const rules: LayoutRules = parsed.value;

function view(
  present: readonly string[],
  tracked: Readonly<Record<string, string>> = {},
  hasContent = false,
): RepoView {
  return {
    has: (entry) => present.includes(entry),
    tracked: Object.keys(tracked),
    startOf: (file) => tracked[file],
    hasContent,
  };
}

describe('FR-012 the rules', () => {
  it('are read from the contract file through the reader', () => {
    expect(rules.required).toContain('scripts/check.sh');
    expect(rules.exceptions['agent-config']).toEqual([{ entry: 'scripts/check.sh', standIn: 'scripts/check-docs.sh' }]);
    expect(parseRules('schema: repo-layout/v1\n')).toMatchObject({ ok: false });
  });
});

describe('FR-012 findings', () => {
  const all = rules.required;

  it('lists every missing entry, not only the first', () => {
    const findings = checkLayout(
      rules,
      undefined,
      view(all.filter((entry) => entry !== 'README.md' && entry !== 'tools/')),
    );
    expect(findings).toEqual(['missing required entry README.md', 'missing required entry tools/']);
  });

  it('accepts the stand-in only for the repository that has the exception', () => {
    const present = [...all.filter((entry) => entry !== 'scripts/check.sh'), 'scripts/check-docs.sh'];
    expect(checkLayout(rules, 'agent-config', view(present))).toEqual([]);
    expect(checkLayout(rules, 'other-repo', view(present))).toEqual(['missing required entry scripts/check.sh']);
  });

  it('asks for index.md only when the repository holds content', () => {
    expect(checkLayout(rules, undefined, view(all, {}, false))).toEqual([]);
    expect(checkLayout(rules, undefined, view(all, {}, true))).toEqual(['missing required entry index.md']);
  });

  it('AC-16.10 finds a tracked file that starts with the generated-from line, also after front matter', () => {
    const line = 'Generated from `a.md`; edit that file, not this copy.';
    const tracked = {
      'copy.md': `${line}\nText`,
      'fm.md': `---\nx: 1\n---\n${line}\n`,
      'plain.md': 'Generated from a note\n',
    };
    expect(checkLayout(rules, undefined, view(all, tracked))).toEqual([
      'tracked file starts with the generated-from line: copy.md',
      'tracked file starts with the generated-from line: fm.md',
    ]);
  });

  it('AC-16.10 finds a tracked file in a build-output folder', () => {
    expect(checkLayout(rules, undefined, view(all, { 'dist/x.js': '', 'src/dist/y.js': '' }))).toEqual([
      'tracked file lies in a build-output folder: dist/x.js',
      'tracked file lies in a build-output folder: src/dist/y.js',
    ]);
  });
});

describe('FR-012 the report', () => {
  it('says no findings with exit 0', () => {
    expect(formatFindings([], false)).toEqual({ code: 0, out: 'repo-layout: no findings\n', err: '' });
  });

  it('exits 0 in report mode and 1 outside it', () => {
    expect(formatFindings(['a'], true)).toEqual({
      code: 0,
      out: 'finding: a\nrepo-layout: 1 findings (report mode)\n',
      err: '',
    });
    expect(formatFindings(['a'], false)).toEqual({ code: 1, out: 'finding: a\nrepo-layout: 1 findings\n', err: '' });
  });
});

describe('FR-012 the command', () => {
  const folders: string[] = [];
  afterEach(() => {
    for (const folder of folders.splice(0)) fs.rmSync(folder, { recursive: true, force: true });
  });

  function repoWith(entries: readonly string[]): ToolEnv {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'layout-'));
    folders.push(root);
    for (const entry of entries) {
      if (entry.endsWith('/')) fs.mkdirSync(path.join(root, entry), { recursive: true });
      else {
        fs.mkdirSync(path.dirname(path.join(root, entry)), { recursive: true });
        fs.writeFileSync(path.join(root, entry), 'x\n');
      }
    }
    return {
      cwd: root,
      home: '/h',
      platform: 'linux',
      today: '2026-11-14',
      nodeVersion: '24.12.0',
      gitHead: () => ({ ok: false, message: '' }),
      gitTracked: () => [],
    };
  }

  it('reads the folder: a complete repository has no findings', () => {
    expect(runLayout([], repoWith(rules.required))).toMatchObject({ code: 0, out: 'repo-layout: no findings\n' });
  });

  it('fails outside report mode and passes in it, listing the missing file', () => {
    const env = repoWith(rules.required.filter((entry) => entry !== 'CHANGELOG.md'));
    expect(runLayout([], env).code).toBe(1);
    expect(runLayout(['--report'], env)).toMatchObject({
      code: 0,
      out: expect.stringContaining('finding: missing required entry CHANGELOG.md') as string,
    });
  });

  it('exits 2 for an unknown option', () => {
    expect(runLayout(['--nope'], repoWith([])).code).toBe(2);
  });
});

describe('AC-16.10 a build-output folder at any depth', () => {
  it('finds a nested folder but not a longer name that merely ends the same way', () => {
    const tracked = { 'docs/dist/x.md': '', 'predist/y.md': '', 'a/b/generated/z.md': '' };
    expect(checkLayout(rules, undefined, view(rules.required, tracked))).toEqual([
      'tracked file lies in a build-output folder: docs/dist/x.md',
      'tracked file lies in a build-output folder: a/b/generated/z.md',
    ]);
  });
});

describe('FR-012 a required file that is a symbolic link', () => {
  it('counts as present when it points to a file and missing when the link is broken', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'layout-link-'));
    try {
      fs.writeFileSync(path.join(root, 'real.md'), 'x\n');
      fs.symlinkSync('real.md', path.join(root, 'README.md'));
      fs.symlinkSync('gone.md', path.join(root, 'AGENTS.md'));
      const env: ToolEnv = {
        cwd: root,
        home: '/h',
        platform: 'linux',
        today: '2026-11-14',
        nodeVersion: '24.12.0',
        gitHead: () => ({ ok: false, message: '' }),
        gitTracked: () => [],
      };
      const out = runLayout(['--report'], env).out;
      expect(out).not.toContain('missing required entry README.md');
      expect(out).toContain('missing required entry AGENTS.md');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
