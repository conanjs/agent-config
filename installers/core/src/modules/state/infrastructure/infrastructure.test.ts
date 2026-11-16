// The real adapters on a temporary folder: exclusive creates, owner-only modes, links removed as links, the lock file that refuses a link.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { CheckedPath } from '#state/application/ports/CheckedPath.ts';
import { fileHomeLockStore } from '#state/infrastructure/FileHomeLockStore.ts';
import { nodeFileSystem } from '#state/infrastructure/NodeFileSystem.ts';
import { nodeLinks } from '#state/infrastructure/NodeLinks.ts';
import { nodeClock } from '#state/infrastructure/NodeClock.ts';

let root = '';
const at = (...parts: string[]): CheckedPath => path.join(root, ...parts) as CheckedPath;
const posix = process.platform !== 'win32';

beforeAll(() => {
  root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'state-infra-')));
});
afterAll(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

describe('NodeFileSystem', () => {
  it.skipIf(!posix)('creates a file exclusively and owner-only', () => {
    nodeFileSystem.writeFile(at('a.txt'), 'one');
    expect(fs.statSync(at('a.txt')).mode & 0o777).toBe(0o600);
    expect(() => nodeFileSystem.writeFile(at('a.txt'), 'two')).toThrow(/EEXIST/);
    expect(fs.readFileSync(at('a.txt'), 'utf8')).toBe('one');
  });

  it.skipIf(!posix)('M-04 will not write through a dangling link', () => {
    fs.symlinkSync(at('nowhere.txt'), at('dangling.txt'));
    expect(() => nodeFileSystem.writeFile(at('dangling.txt'), 'x')).toThrow(/EEXIST/);
    expect(fs.existsSync(at('nowhere.txt'))).toBe(false);
  });

  it.skipIf(!posix)('M-04 will not append through a link', () => {
    fs.writeFileSync(at('target.txt'), 'precious');
    fs.symlinkSync(at('target.txt'), at('log-link.jsonl'));
    expect(() => nodeFileSystem.appendFile(at('log-link.jsonl'), 'x')).toThrow();
    expect(fs.readFileSync(at('target.txt'), 'utf8')).toBe('precious');
  });

  it.skipIf(!posix)('appends owner-only and keeps what is there', () => {
    nodeFileSystem.appendFile(at('log.jsonl'), 'a\n');
    nodeFileSystem.appendFile(at('log.jsonl'), 'b\n');
    expect(fs.readFileSync(at('log.jsonl'), 'utf8')).toBe('a\nb\n');
    expect(fs.statSync(at('log.jsonl')).mode & 0o777).toBe(0o600);
  });

  it('makes one folder, says existed for a folder, and refuses a file of that name', () => {
    expect(nodeFileSystem.makeDirectory(at('folder'))).toBe('created');
    expect(nodeFileSystem.makeDirectory(at('folder'))).toBe('existed');
    fs.writeFileSync(at('plain'), 'x');
    expect(() => nodeFileSystem.makeDirectory(at('plain'))).toThrow(/EEXIST/);
    expect(() => nodeFileSystem.makeDirectory(at('missing', 'deep'))).toThrow(/ENOENT/);
  });

  it.skipIf(!posix)('makes a folder owner-only', () => {
    nodeFileSystem.makeDirectory(at('private'));
    expect(fs.statSync(at('private')).mode & 0o777).toBe(0o700);
  });

  it('renames a file over another in one step', () => {
    fs.writeFileSync(at('new.txt'), 'new');
    fs.writeFileSync(at('old.txt'), 'old');
    nodeFileSystem.rename(at('new.txt'), at('old.txt'));
    expect(fs.readFileSync(at('old.txt'), 'utf8')).toBe('new');
    expect(fs.existsSync(at('new.txt'))).toBe(false);
  });

  it.skipIf(!posix)('M-04 removes a link as a link and leaves its target', () => {
    fs.mkdirSync(at('keep'));
    fs.writeFileSync(at('keep', 'file.md'), 'keep');
    fs.symlinkSync(at('keep'), at('keep-link'));
    nodeFileSystem.remove(at('keep-link'));
    expect(fs.existsSync(at('keep-link'))).toBe(false);
    expect(fs.readFileSync(at('keep', 'file.md'), 'utf8')).toBe('keep');
  });

  it.skipIf(!posix)('M-04 removes a folder with a link inside without following the link', () => {
    fs.mkdirSync(at('tree'));
    fs.mkdirSync(at('outside'));
    fs.writeFileSync(at('outside', 'f.md'), 'outside');
    fs.symlinkSync(at('outside'), at('tree', 'escape'));
    nodeFileSystem.remove(at('tree'));
    expect(fs.existsSync(at('tree'))).toBe(false);
    expect(fs.readFileSync(at('outside', 'f.md'), 'utf8')).toBe('outside');
  });

  it.skipIf(!posix)('copies a tree with its links kept as links, and refuses a copy that exists', () => {
    fs.mkdirSync(at('src'));
    fs.writeFileSync(at('src', 'a.md'), 'a');
    fs.symlinkSync('a.md', at('src', 'ln'));
    nodeFileSystem.copyTree(at('src'), at('dst'));
    expect(fs.readlinkSync(at('dst', 'ln'))).toBe('a.md');
    expect(() => nodeFileSystem.copyTree(at('src'), at('dst'))).toThrow();
  });

  it.skipIf(!posix)('sets a mode', () => {
    nodeFileSystem.setMode(at('old.txt'), 0o640);
    expect(fs.statSync(at('old.txt')).mode & 0o777).toBe(0o640);
  });

  it('reads, lists sorted, stats without following a link, and answers absent', () => {
    expect(nodeFileSystem.readFile(at('old.txt'))).toBe('new');
    expect(nodeFileSystem.readDirectory(at('folder'))).toEqual([]);
    expect(nodeFileSystem.stat(at('old.txt'))).toMatchObject({ kind: 'file', size: 3 });
    expect(nodeFileSystem.stat(at('folder'))?.kind).toBe('folder');
    expect(nodeFileSystem.stat(at('nothing'))).toBeUndefined();
    expect(nodeFileSystem.stat(at('old.txt', 'below'))).toBeUndefined();
    expect(nodeFileSystem.exists(at('nothing'))).toBe(false);
    expect(nodeFileSystem.realPath(at('old.txt'))).toBe(at('old.txt'));
  });

  it.skipIf(!posix)('stat and exists see a dangling link as a link that exists', () => {
    expect(nodeFileSystem.stat(at('dangling.txt'))?.kind).toBe('link');
    expect(nodeFileSystem.exists(at('dangling.txt'))).toBe(true);
  });

  it('refuses to read a file over 16 MiB', () => {
    fs.writeFileSync(at('big'), Buffer.alloc(16 * 1024 * 1024 + 1));
    expect(() => nodeFileSystem.readFile(at('big'))).toThrow(/16 MiB/);
  });
});

describe.skipIf(!posix)('NodeLinks', () => {
  it('creates, reads and removes a link, and refuses to remove what is not a link', () => {
    fs.mkdirSync(at('t1'));
    nodeLinks.createLink(at('l1'), at('t1'), 'symlink');
    expect(nodeLinks.readLink(at('l1'))).toBe(at('t1'));
    nodeLinks.removeLink(at('l1'));
    expect(fs.existsSync(at('l1'))).toBe(false);
    expect(() => nodeLinks.removeLink(at('t1'))).toThrow(/not a link/);
    expect(fs.existsSync(at('t1'))).toBe(true);
  });

  it('DR-202 switches a link to a folder in one step and leaves no temporary link', () => {
    fs.mkdirSync(at('a1'));
    fs.mkdirSync(at('a2'));
    fs.symlinkSync(at('a1'), at('sw'));
    nodeLinks.switchLink(at('sw'), at('a2'), 'symlink');
    expect(fs.readlinkSync(at('sw'))).toBe(at('a2'));
    expect(fs.readdirSync(root).filter((name) => name.includes('.switch-'))).toEqual([]);
  });

  it('removes the temporary link when the rename fails', () => {
    fs.mkdirSync(at('real-folder'));
    fs.writeFileSync(at('real-folder', 'x'), 'x');
    expect(() => nodeLinks.switchLink(at('real-folder'), at('a1'), 'symlink')).toThrow();
    expect(fs.readdirSync(root).filter((name) => name.includes('.switch-'))).toEqual([]);
  });
});

describe('fileHomeLockStore', () => {
  it('creates once, exclusively and owner-only, then says exists', () => {
    const store = fileHomeLockStore(at('install.lock'));
    expect(store.tryCreate('one\n')).toBe('created');
    expect(store.tryCreate('two\n')).toBe('exists');
    expect(store.read()).toMatchObject({ kind: 'file', text: 'one\n' });
    if (posix) expect(fs.statSync(at('install.lock')).mode & 0o777).toBe(0o600);
  });

  it('removes only the text it is given', () => {
    const store = fileHomeLockStore(at('install.lock'));
    expect(store.removeIfSame('other\n')).toBe('changed');
    expect(store.removeIfSame('one\n')).toBe('removed');
    expect(store.removeIfSame('one\n')).toBe('absent');
    expect(store.read()).toEqual({ kind: 'absent' });
  });

  it.skipIf(!posix)('M-04 reads a link as a link and never removes or creates through it', () => {
    fs.writeFileSync(at('real.txt'), 'precious');
    fs.symlinkSync(at('real.txt'), at('linked.lock'));
    const store = fileHomeLockStore(at('linked.lock'));
    expect(store.read()).toEqual({ kind: 'link' });
    expect(store.tryCreate('x')).toBe('exists');
    expect(store.removeIfSame('precious')).toBe('changed');
    expect(fs.readFileSync(at('real.txt'), 'utf8')).toBe('precious');
  });

  it('reads a folder as unreadable and a lock over 4 KiB cut at the limit', () => {
    fs.mkdirSync(at('folder.lock'));
    expect(fileHomeLockStore(at('folder.lock')).read()).toEqual({ kind: 'unreadable' });
    fs.writeFileSync(at('long.lock'), 'x'.repeat(10_000));
    const read = fileHomeLockStore(at('long.lock')).read();
    expect(read.kind === 'file' && read.text.length).toBe(4097);
  });
});

describe('nodeClock', () => {
  it('reads the time and waits', async () => {
    expect(Math.abs(nodeClock.now().getTime() - Date.now())).toBeLessThan(1000);
    await expect(nodeClock.sleep(1)).resolves.toBeUndefined();
  });
});
