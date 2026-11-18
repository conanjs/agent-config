// M-03, M-04: the real reader of the install pipeline on a temporary folder: containment, links never followed, limits.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { nodePathProbe } from '#shared/infrastructure/nodePathProbe.ts';
import { nodePathObserver } from '#wiring/infrastructure/NodePathObserver.ts';
import { createNodeDiskReader, MAX_TEXT_BYTES } from '#commands/infrastructure/NodeDiskReader.ts';

let root: string;
const reader = createNodeDiskReader(nodePathProbe, nodePathObserver, 'posix');

beforeEach(() => {
  root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ac-disk-')));
  fs.mkdirSync(path.join(root, 'docs', 'deep'), { recursive: true });
  fs.mkdirSync(path.join(root, '.git'));
  fs.mkdirSync(path.join(root, 'node_modules', 'x'), { recursive: true });
  fs.writeFileSync(path.join(root, 'index.md'), '# index\n');
  fs.writeFileSync(path.join(root, 'docs', 'a.md'), 'a\n');
  fs.writeFileSync(path.join(root, 'docs', 'deep', 'b.md'), 'b\n');
  fs.writeFileSync(path.join(root, 'docs', 'notes.txt'), 'not markdown\n');
  fs.writeFileSync(path.join(root, '.git', 'c.md'), 'in git\n');
  fs.writeFileSync(path.join(root, 'node_modules', 'x', 'd.md'), 'dependency\n');
});
afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

describe('the markdown scan', () => {
  it('lists Markdown files in path order, skipping .git and node_modules', () => {
    expect(reader.markdownFiles(root).map((file) => file.file)).toEqual(['docs/a.md', 'docs/deep/b.md', 'index.md']);
  });

  it('never follows a link, so a link out of the folder adds no file', () => {
    const outside = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ac-outside-')));
    fs.writeFileSync(path.join(outside, 'secret.md'), 'secret\n');
    fs.symlinkSync(outside, path.join(root, 'docs', 'link'));
    fs.symlinkSync(path.join(outside, 'secret.md'), path.join(root, 'docs', 'secret.md'));
    expect(reader.markdownFiles(root).map((file) => file.file)).toEqual(['docs/a.md', 'docs/deep/b.md', 'index.md']);
    fs.rmSync(outside, { recursive: true, force: true });
  });

  it('leaves out a file over the size limit instead of cutting it', () => {
    fs.writeFileSync(path.join(root, 'big.md'), 'x'.repeat(MAX_TEXT_BYTES + 1));
    expect(reader.markdownFiles(root).map((file) => file.file)).not.toContain('big.md');
  });
});

describe('reading below a root', () => {
  it('reads a text file, and says nothing for a missing one, a folder or a path that leaves the root', () => {
    expect(reader.readOptionalText(root, 'index.md')).toBe('# index\n');
    expect(reader.readOptionalText(root, 'missing.md')).toBeUndefined();
    expect(reader.readOptionalText(root, 'docs')).toBeUndefined();
    expect(reader.readOptionalText(root, '../etc/passwd')).toBeUndefined();
  });

  it('refuses a link that leaves the root', () => {
    fs.symlinkSync(os.tmpdir(), path.join(root, 'out'));
    expect(reader.entryKind(root, 'out')).toBe('missing');
    expect(reader.readOptionalText(root, 'out/anything')).toBeUndefined();
  });

  it('tells what is at a path', () => {
    expect(reader.entryKind(root, 'index.md')).toBe('file');
    expect(reader.entryKind(root, 'docs')).toBe('folder');
    expect(reader.entryKind(root, 'nope')).toBe('missing');
  });
});

describe('listing and observing', () => {
  it('lists names sorted, and nothing for a folder that is not there', () => {
    expect(reader.listEntries(path.join(root, 'docs'))).toEqual(['a.md', 'deep', 'notes.txt']);
    expect(reader.listEntries(path.join(root, 'nope'))).toBeUndefined();
  });

  it('observes a link as a link', () => {
    fs.symlinkSync('index.md', path.join(root, 'l'));
    expect(reader.observe(path.join(root, 'l'))).toEqual({ kind: 'link', target: 'index.md' });
    expect(reader.observe(path.join(root, 'nope'))).toEqual({ kind: 'absent' });
  });
});
