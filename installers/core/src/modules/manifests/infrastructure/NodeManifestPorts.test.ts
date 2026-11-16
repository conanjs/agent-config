// The Node adapters on a real temporary folder, and the use cases against probes that cannot answer (fail closed).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { findEscapingLinks } from '#manifests/application/read/findEscapingLinks.ts';
import { MAX_TREE_ENTRIES, createNodeManifestPorts } from '#manifests/infrastructure/NodeManifestPorts.ts';

let temp = '';
beforeEach(() => {
  temp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'node-ports-')));
});
afterEach(() => {
  fs.rmSync(temp, { recursive: true, force: true });
});

describe('Node manifest ports', () => {
  const ports = createNodeManifestPorts();

  it.each([
    ['a folder', () => temp, 'folder'],
    [
      'a file',
      () => {
        fs.writeFileSync(path.join(temp, 'f'), '');
        return path.join(temp, 'f');
      },
      'not-folder',
    ],
    ['nothing', () => path.join(temp, 'none'), 'missing'],
    [
      'below a file',
      () => {
        fs.writeFileSync(path.join(temp, 'f2'), '');
        return path.join(temp, 'f2', 'x');
      },
      'missing',
    ],
  ] as const)('answers the state of %s', (_title, make, expected) => {
    expect(ports.files.folderState(make())).toBe(expected);
  });

  it('probes real paths, missing paths and links', () => {
    fs.writeFileSync(path.join(temp, 'a'), '');
    fs.symlinkSync(path.join(temp, 'a'), path.join(temp, 'ln'));
    fs.symlinkSync(path.join(temp, 'gone'), path.join(temp, 'dangling'));
    expect(ports.probe.realPath(path.join(temp, 'ln'))).toEqual({ kind: 'real', path: path.join(temp, 'a') });
    expect(ports.probe.realPath(path.join(temp, 'dangling'))).toEqual({ kind: 'missing' });
    expect(ports.probe.isLink(path.join(temp, 'ln'))).toBe('link');
    expect(ports.probe.isLink(path.join(temp, 'dangling'))).toBe('link');
    expect(ports.probe.isLink(path.join(temp, 'a'))).toBe('not-link');
    expect(ports.probe.isLink(path.join(temp, 'none'))).toBe('not-link');
  });

  it('answers unknown for a link loop', () => {
    fs.symlinkSync(path.join(temp, 'l2'), path.join(temp, 'l1'));
    fs.symlinkSync(path.join(temp, 'l1'), path.join(temp, 'l2'));
    expect(ports.probe.realPath(path.join(temp, 'l1'))).toEqual({ kind: 'unknown' });
  });

  it('reads at most the limit and says when the file is longer', () => {
    fs.writeFileSync(path.join(temp, 'big'), 'x'.repeat(100));
    const contained = { realPath: path.join(temp, 'big') } as never;
    expect(ports.files.readText(contained, 10)).toEqual({ kind: 'text', text: 'x'.repeat(10), truncated: true });
    expect(ports.files.readText(contained, 101)).toEqual({ kind: 'text', text: 'x'.repeat(100), truncated: false });
    expect(ports.files.readText({ realPath: path.join(temp, 'none') } as never, 10)).toEqual({ kind: 'missing' });
    expect(ports.files.readText({ realPath: temp } as never, 10)).toEqual({ kind: 'unreadable' });
  });

  it('lists links without entering them, sorted, and stops at the limit', () => {
    fs.mkdirSync(path.join(temp, 'd'));
    fs.symlinkSync(temp, path.join(temp, 'd', 'up'));
    fs.symlinkSync(temp, path.join(temp, 'a-link'));
    expect(ports.tree.listLinks(temp)).toEqual({ kind: 'listed', links: ['a-link', 'd/up'] });
    expect(ports.tree.listLinks(path.join(temp, 'none'))).toEqual({ kind: 'unreadable' });
    expect(MAX_TREE_ENTRIES).toBe(50_000);
  });
});

describe('findEscapingLinks fails closed', () => {
  const deps = (probe: Record<string, unknown>, listing: unknown) =>
    ({
      flavor: 'posix',
      gitPolicy: { allowedProtocols: ['https', 'ssh'] },
      ports: {
        probe: { realPath: () => ({ kind: 'real', path: '/root' }), isLink: () => 'link', ...probe },
        files: {},
        tree: { listLinks: () => listing },
      },
    }) as never;

  it.each([
    ['too many entries', {}, { kind: 'too-many' }],
    ['an unreadable folder', {}, { kind: 'unreadable' }],
    ['a root that cannot be resolved', { realPath: () => ({ kind: 'unknown' }) }, { kind: 'listed', links: [] }],
  ])('%s is unchecked', (_title, probe, listing) => {
    expect(findEscapingLinks(deps(probe, listing), '/root')).toEqual({ kind: 'unchecked' });
  });

  it.each([
    ['a link that cannot be resolved', { kind: 'unknown' }],
    ['a link that points at nothing', { kind: 'missing' }],
    ['a link outside the root', { kind: 'real', path: '/other/x' }],
    ['a sibling that shares the root name', { kind: 'real', path: '/root-evil/x' }],
  ])('%s escapes', (_title, answer) => {
    const probe = { realPath: (target: string) => (target === '/root' ? { kind: 'real', path: '/root' } : answer) };
    expect(findEscapingLinks(deps(probe as never, { kind: 'listed', links: ['a/b'] }), '/root')).toEqual({
      kind: 'escapes',
      link: 'a/b',
    });
  });

  it('accepts a link that ends inside the root', () => {
    const probe = {
      realPath: (target: string) => ({ kind: 'real', path: target === '/root' ? '/root' : '/root/inner' }),
    };
    expect(findEscapingLinks(deps(probe as never, { kind: 'listed', links: ['a'] }), '/root')).toEqual({
      kind: 'clean',
    });
  });
});
