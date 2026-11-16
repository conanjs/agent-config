import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { nodeFileIdentity } from '#shared/infrastructure/nodeFileIdentity.ts';

let root = '';
beforeAll(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'identity-'));
});
afterAll(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

describe('M-03 file identity', () => {
  it('gives one identity to a folder and to a link to it, and another to a sibling', () => {
    fs.mkdirSync(path.join(root, 'a'));
    fs.mkdirSync(path.join(root, 'b'));
    const here = nodeFileIdentity(path.join(root, 'a'));
    if (process.platform !== 'win32') {
      fs.symlinkSync(path.join(root, 'a'), path.join(root, 'link'));
      expect(nodeFileIdentity(path.join(root, 'link'))).toEqual(here);
    }
    expect(here.kind).toBe('identity');
    expect(nodeFileIdentity(path.join(root, 'b'))).not.toEqual(here);
  });

  it('answers missing for a path that is not there and for a path below a file', () => {
    fs.writeFileSync(path.join(root, 'file'), 'x');
    expect(nodeFileIdentity(path.join(root, 'nope'))).toEqual({ kind: 'missing' });
    expect(nodeFileIdentity(path.join(root, 'file', 'below'))).toEqual({ kind: 'missing' });
  });
});
