// The real adapters on a temporary folder: a link is seen as a link and never followed, and the hook file reader refuses what it cannot be sure of.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { COPILOT_FOLDER } from '#wiring/domain/compat/CompatLinks.ts';
import { nodeHookFiles } from '#wiring/infrastructure/NodeHookFiles.ts';
import { nodePathObserver } from '#wiring/infrastructure/NodePathObserver.ts';

let root = '';
const posix = process.platform !== 'win32';
const at = (...parts: string[]): string => path.join(root, ...parts);

beforeAll(() => {
  root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'wiring-')));
});
afterAll(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

describe('NodePathObserver', () => {
  it('sees a file, a folder, and nothing', () => {
    fs.mkdirSync(at('folder'));
    fs.writeFileSync(at('file'), 'x');
    expect(nodePathObserver.observe(at('folder'))).toEqual({ kind: 'folder' });
    expect(nodePathObserver.observe(at('file'))).toEqual({ kind: 'file' });
    expect(nodePathObserver.observe(at('nope'))).toEqual({ kind: 'absent' });
    expect(nodePathObserver.observe(at('file', 'below'))).toEqual({ kind: 'absent' });
  });

  it.skipIf(!posix)('sees a link as a link with its target text, working or dangling, and never follows it', () => {
    fs.symlinkSync(at('folder'), at('link'));
    fs.symlinkSync(at('nowhere'), at('dangling'));
    fs.symlinkSync('relative/target', at('relative'));
    expect(nodePathObserver.observe(at('link'))).toEqual({ kind: 'link', target: at('folder') });
    expect(nodePathObserver.observe(at('dangling'))).toEqual({ kind: 'link', target: at('nowhere') });
    expect(nodePathObserver.observe(at('relative'))).toEqual({ kind: 'link', target: 'relative/target' });
  });

  it('answers unknown for an error that is not "not there"', () => {
    expect(nodePathObserver.observe(`${root}/${'a'.repeat(5000)}`)).toEqual({ kind: 'unknown' });
  });
});

describe('NodeHookFiles', () => {
  const home = (): string => at('user');
  function seed(file: string, text: string): void {
    fs.mkdirSync(path.dirname(path.join(home(), file)), { recursive: true });
    fs.writeFileSync(path.join(home(), file), text);
  }

  it('reads nothing and is sure when no agent file exists', () => {
    fs.mkdirSync(home(), { recursive: true });
    expect(nodeHookFiles(home(), process.platform === 'win32' ? 'win32' : 'posix').readAll()).toEqual({
      texts: [],
      unreadable: false,
    });
  });

  it('reads the settings and hook files of the three agents, and Copilot hook json files', () => {
    seed('.claude/settings.json', 'claude');
    seed('.claude/settings.local.json', 'claude-local');
    seed('.codex/hooks.json', 'codex');
    seed('.codex/config.toml', 'toml');
    seed(`${COPILOT_FOLDER}/hooks/agent-config.json`, 'copilot');
    seed(`${COPILOT_FOLDER}/hooks/notes.txt`, 'not a hook file');
    const result = nodeHookFiles(home(), process.platform === 'win32' ? 'win32' : 'posix').readAll();
    expect([...result.texts].sort()).toEqual(['claude', 'claude-local', 'codex', 'copilot', 'toml']);
    expect(result.unreadable).toBe(false);
  });

  it('M-14 says it is unsure for a file over 1 MiB', () => {
    seed('.claude/settings.json', 'x'.repeat(1_048_577));
    expect(nodeHookFiles(home(), process.platform === 'win32' ? 'win32' : 'posix').readAll().unreadable).toBe(true);
  });

  it.skipIf(!posix)('M-14 says it is unsure for a settings file that is a link, and does not read through it', () => {
    fs.rmSync(path.join(home(), '.claude', 'settings.json'));
    fs.writeFileSync(at('elsewhere.json'), 'secret text');
    fs.symlinkSync(at('elsewhere.json'), path.join(home(), '.claude', 'settings.json'));
    const result = nodeHookFiles(home(), 'posix').readAll();
    expect(result.unreadable).toBe(true);
    expect(result.texts).not.toContain('secret text');
  });

  it.skipIf(!posix || process.getuid?.() === 0)('M-14 says it is unsure for a file it cannot read', () => {
    fs.rmSync(path.join(home(), '.claude', 'settings.json'), { force: true });
    seed('.claude/settings.json', 'locked');
    fs.chmodSync(path.join(home(), '.claude', 'settings.json'), 0o000);
    expect(nodeHookFiles(home(), 'posix').readAll().unreadable).toBe(true);
    fs.chmodSync(path.join(home(), '.claude', 'settings.json'), 0o600);
  });
});
