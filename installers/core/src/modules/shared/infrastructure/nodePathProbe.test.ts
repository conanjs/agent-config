import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { nodePathProbe } from '#shared/infrastructure/nodePathProbe.ts';

let root = '';
beforeAll(() => {
  root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'probe-')));
  fs.mkdirSync(path.join(root, 'folder'));
  fs.writeFileSync(path.join(root, 'file'), 'x');
  if (process.platform !== 'win32') {
    fs.symlinkSync(path.join(root, 'folder'), path.join(root, 'link'));
    fs.symlinkSync(path.join(root, 'nowhere'), path.join(root, 'dangling'));
  }
});
afterAll(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

describe('M-03 the real path probe', () => {
  it('gives the canonical path, missing for a path that is not there and for one below a file', () => {
    expect(nodePathProbe.realPath(path.join(root, 'folder'))).toEqual({
      kind: 'real',
      path: path.join(root, 'folder'),
    });
    expect(nodePathProbe.realPath(path.join(root, 'nope'))).toEqual({ kind: 'missing' });
    expect(nodePathProbe.realPath(path.join(root, 'file', 'below'))).toEqual({ kind: 'missing' });
  });

  it.skipIf(process.platform === 'win32')(
    'follows a link for the real path, tells links from other things, and calls a dangling link missing',
    () => {
      expect(nodePathProbe.realPath(path.join(root, 'link'))).toEqual({
        kind: 'real',
        path: path.join(root, 'folder'),
      });
      expect(nodePathProbe.isLink(path.join(root, 'link'))).toBe('link');
      expect(nodePathProbe.isLink(path.join(root, 'dangling'))).toBe('link');
      expect(nodePathProbe.realPath(path.join(root, 'dangling'))).toEqual({ kind: 'missing' });
      expect(nodePathProbe.identity(path.join(root, 'link'))).toEqual(
        nodePathProbe.identity(path.join(root, 'folder')),
      );
    },
  );

  it('says not-link for a file, a folder and a path that is not there', () => {
    expect(['file', 'folder', 'nope'].map((name) => nodePathProbe.isLink(path.join(root, name)))).toEqual([
      'not-link',
      'not-link',
      'not-link',
    ]);
  });

  it('answers unknown for an error that is not "not there"', () => {
    expect(nodePathProbe.realPath(`${root}/${'a'.repeat(5000)}`)).toEqual({ kind: 'unknown' });
  });
});
