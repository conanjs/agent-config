// An in-memory disk that answers the state ports: FileSystem, Links, HomeLockStore and the shared PathProbe. It serves a dry run (DR-306:
// "a dry run applies the plan to an in-memory recorder") and the unit tests of the journal, where a kill is a thrown error between two
// calls. Paths follow the path syntax it is built with, so the Windows ladder can be tested with `C:\` paths. Links are followed in
// the middle of a path and kept at the end, as a real disk does.
import path from 'node:path';
import type { PathProbe } from '#shared/application/containment/PathProbe.ts';
import type { PathFlavor } from '#shared/domain/path/PathContainment.ts';
import type { FileStat, FileSystem } from '#state/application/ports/FileSystem.ts';
import type { HomeLockStore } from '#state/application/ports/HomeLockStore.ts';
import type { Links } from '#state/application/ports/Links.ts';

type NodeBase = { readonly id: number; mode: number; mtimeMs: number };
type DiskNode =
  | (NodeBase & { readonly kind: 'file'; text: string })
  | (NodeBase & { readonly kind: 'folder' })
  | (NodeBase & { readonly kind: 'link'; target: string });
type NodeSpec =
  | { readonly kind: 'file'; readonly text: string; readonly mode: number }
  | { readonly kind: 'folder'; readonly mode: number }
  | { readonly kind: 'link'; readonly target: string; readonly mode: number };

/** The ports of one in-memory disk, with a text listing for comparing two states. */
export interface MemoryDisk {
  /** The file operations. */
  readonly fs: FileSystem;
  /** The link operations. */
  readonly links: Links;
  /** The real-path, link and identity questions. */
  readonly probe: PathProbe;
  /** Makes a folder and every folder above it, for setting a scene. */
  seedFolder(folder: string): void;
  /** Makes a file (and its folder), for setting a scene. */
  seedFile(file: string, text: string): void;
  /** Makes a link (and its folder), for setting a scene. */
  seedLink(link: string, target: string): void;
  /** Makes a lock file store over one path of this disk. */
  lockStoreAt(lockPath: string): HomeLockStore;
  /** Sets the time that new and changed nodes get. */
  setTime(milliseconds: number): void;
  /** Lists every node as `path kind mode detail`, sorted, so two moments compare with `toEqual`. */
  listing(): string[];
}

function fail(code: string, message: string): never {
  throw Object.assign(new Error(`${code}: ${message}`), { code });
}

// The tree of nodes and the rules that find one: the part of the disk every port shares.
interface Core {
  readonly flavored: path.PlatformPath;
  readonly nodes: Map<string, DiskNode>;
  clock: { time: number; nextId: number };
  key(text: string): string;
  parentOf(text: string): string;
  isRoot(text: string): boolean;
  resolve(text: string, followFinal: boolean, hops?: number): string | undefined;
  at(text: string): { key: string; node: DiskNode | undefined };
  needFolder(text: string): void;
  add(text: string, spec: NodeSpec): void;
  below(folder: string): string[];
}

function makeCore(flavor: PathFlavor): Core {
  const flavored = path[flavor];
  const nodes = new Map<string, DiskNode>();
  const clock = { time: 1_000, nextId: 1 };
  const core: Core = {
    flavored,
    nodes,
    clock,
    key: (text) => flavored.normalize(text),
    parentOf: (text) => flavored.dirname(flavored.normalize(text)),
    isRoot: (text) => flavored.dirname(flavored.normalize(text)) === flavored.normalize(text),
    resolve(text, followFinal, hops = 0) {
      if (hops > 40) return undefined;
      const target = core.key(text);
      if (core.isRoot(target)) return target;
      const parent = core.resolve(core.parentOf(target), true, hops + 1);
      if (parent === undefined) return undefined;
      const here = flavored.join(parent, flavored.basename(target));
      const node = nodes.get(here);
      if (node?.kind === 'link' && followFinal) {
        return core.resolve(
          flavored.isAbsolute(node.target) ? node.target : flavored.join(parent, node.target),
          true,
          hops + 1,
        );
      }
      return here;
    },
    at(text) {
      const found = core.resolve(text, false);
      if (found === undefined) fail('ELOOP', 'too many links');
      return { key: found, node: nodes.get(found) };
    },
    needFolder(text) {
      const parent = core.resolve(core.parentOf(text), true);
      if (parent === undefined || (!core.isRoot(parent) && nodes.get(parent)?.kind !== 'folder'))
        fail('ENOENT', 'no such folder');
    },
    add(text, spec) {
      core.needFolder(text);
      nodes.set(core.at(text).key, { ...spec, id: clock.nextId, mtimeMs: clock.time });
      clock.nextId += 1;
    },
    below(folder) {
      const prefix = folder.endsWith(flavored.sep) ? folder : folder + flavored.sep;
      return [...nodes.keys()].filter((candidate) => candidate !== folder && candidate.startsWith(prefix));
    },
  };
  return core;
}

type CreateOperations = Pick<FileSystem, 'writeFile' | 'appendFile' | 'makeDirectory' | 'setMode'>;
type MoveOperations = Pick<FileSystem, 'rename' | 'remove' | 'copyTree'>;
type ReadOperations = Pick<FileSystem, 'readFile' | 'readDirectory' | 'stat' | 'exists' | 'realPath'>;

function buildCreates(core: Core): CreateOperations {
  const { clock } = core;
  return {
    writeFile(file, text) {
      core.needFolder(file);
      if (core.at(file).node !== undefined) fail('EEXIST', 'file exists');
      core.add(file, { kind: 'file', text, mode: 0o600 });
    },
    appendFile(file, text) {
      const found = core.at(file);
      if (found.node?.kind === 'link') fail('ELOOP', 'a link is at the path');
      if (found.node === undefined) return core.add(file, { kind: 'file', text, mode: 0o600 });
      if (found.node.kind !== 'file') fail('EISDIR', 'not a file');
      found.node.text += text;
      found.node.mtimeMs = clock.time;
      return undefined;
    },
    makeDirectory(folder) {
      core.needFolder(folder);
      const found = core.at(folder);
      if (found.node?.kind === 'folder') return 'existed';
      if (found.node !== undefined) fail('EEXIST', 'something else is there');
      core.add(folder, { kind: 'folder', mode: 0o700 });
      return 'created';
    },
    setMode(target, mode) {
      const found = core.at(target);
      if (found.node === undefined) fail('ENOENT', 'no such path');
      if (found.node.kind !== 'link') found.node.mode = mode;
    },
  };
}

function buildMoves(core: Core): MoveOperations {
  const { nodes, clock } = core;
  return {
    rename(from, to) {
      const source = core.at(from);
      if (source.node === undefined) fail('ENOENT', 'no such path');
      core.needFolder(to);
      const destination = core.at(to);
      if (destination.node?.kind === 'folder') fail('EISDIR', 'the target is a folder');
      const moved = [source.key, ...core.below(source.key)].map((old) => [old, nodes.get(old)] as const);
      for (const [old] of moved) nodes.delete(old);
      for (const [old, node] of moved) {
        if (node !== undefined) nodes.set(destination.key + old.slice(source.key.length), node);
      }
    },
    remove(target) {
      const found = core.at(target);
      if (found.node === undefined) fail('ENOENT', 'no such path');
      for (const child of core.below(found.key)) nodes.delete(child);
      nodes.delete(found.key);
    },
    copyTree(from, to) {
      const source = core.at(from);
      if (source.node === undefined) fail('ENOENT', 'no such path');
      core.needFolder(to);
      const destination = core.at(to);
      if (destination.node !== undefined) fail('EEXIST', 'the copy exists');
      for (const old of [source.key, ...core.below(source.key).sort()]) {
        const node = nodes.get(old);
        if (node === undefined) continue;
        nodes.set(destination.key + old.slice(source.key.length), { ...node, id: clock.nextId, mtimeMs: clock.time });
        clock.nextId += 1;
      }
    },
  };
}

function buildReads(core: Core): ReadOperations {
  const { nodes, flavored } = core;
  const reads: ReadOperations = {
    readFile(file) {
      const node = nodes.get(core.resolve(file, true) ?? '');
      if (node?.kind !== 'file') fail('ENOENT', 'not a file');
      return node.text;
    },
    readDirectory(folder) {
      const real = core.resolve(folder, true) ?? '';
      if (!core.isRoot(real) && nodes.get(real)?.kind !== 'folder') fail('ENOTDIR', 'not a folder');
      return core
        .below(real)
        .filter((candidate) => flavored.dirname(candidate) === real)
        .map((candidate) => flavored.basename(candidate))
        .sort();
    },
    stat(target): FileStat | undefined {
      const parent = core.resolve(core.parentOf(target), true);
      if (parent === undefined || (!core.isRoot(parent) && nodes.get(parent)?.kind !== 'folder')) return undefined;
      const node = core.at(target).node;
      if (node === undefined) return undefined;
      const size = node.kind === 'file' ? Buffer.byteLength(node.text) : 0;
      return { kind: node.kind, size, mtimeMs: node.mtimeMs, mode: node.mode };
    },
    exists: (target) => reads.stat(target) !== undefined,
    realPath(target) {
      const real = core.resolve(target, true);
      if (real === undefined || (!core.isRoot(real) && !nodes.has(real))) fail('ENOENT', 'no such path');
      return real;
    },
  };
  return reads;
}

function buildFileSystem(core: Core): FileSystem {
  return { ...buildCreates(core), ...buildMoves(core), ...buildReads(core) };
}

function buildLinks(core: Core): Links {
  const linkAt = (link: string): { key: string; node: DiskNode & { kind: 'link' } } => {
    const found = core.at(link);
    if (found.node?.kind !== 'link') fail('EINVAL', 'not a link');
    return { key: found.key, node: found.node };
  };
  return {
    createLink(link, target) {
      core.needFolder(link);
      if (core.at(link).node !== undefined) fail('EEXIST', 'something is there');
      core.add(link, { kind: 'link', target, mode: 0o777 });
    },
    removeLink(link) {
      core.nodes.delete(linkAt(link).key);
    },
    switchLink(link, target) {
      const { node } = linkAt(link);
      node.target = target;
      node.mtimeMs = core.clock.time;
    },
    readLink: (link) => linkAt(link).node.target,
  };
}

function buildProbe(core: Core): PathProbe {
  return {
    realPath(target) {
      const real = core.resolve(target, true);
      if (real === undefined) return { kind: 'unknown' };
      return core.isRoot(real) || core.nodes.has(real) ? { kind: 'real', path: real } : { kind: 'missing' };
    },
    isLink: (target) => (core.at(target).node?.kind === 'link' ? 'link' : 'not-link'),
    identity(target) {
      const real = core.resolve(target, true);
      if (real !== undefined && core.isRoot(real)) return { kind: 'identity', dev: 1n, ino: 0n };
      const node = real === undefined ? undefined : core.nodes.get(real);
      return node === undefined ? { kind: 'missing' } : { kind: 'identity', dev: 1n, ino: BigInt(node.id) };
    },
  };
}

function buildLockStore(core: Core, lockPath: string): HomeLockStore {
  return {
    path: lockPath,
    tryCreate(text) {
      if (core.at(lockPath).node !== undefined) return 'exists';
      core.add(lockPath, { kind: 'file', text, mode: 0o600 });
      return 'created';
    },
    read() {
      const node = core.at(lockPath).node;
      if (node === undefined) return { kind: 'absent' };
      if (node.kind === 'link') return { kind: 'link' };
      return node.kind === 'file'
        ? { kind: 'file', text: node.text, modifiedMs: node.mtimeMs }
        : { kind: 'unreadable' };
    },
    removeIfSame(text) {
      const found = core.at(lockPath);
      if (found.node === undefined) return 'absent';
      if (found.node.kind !== 'file' || found.node.text !== text) return 'changed';
      core.nodes.delete(found.key);
      return 'removed';
    },
  };
}

function describe(node: DiskNode): string {
  const detail = node.kind === 'file' ? JSON.stringify(node.text) : node.kind === 'link' ? node.target : '';
  return `${node.kind} ${node.mode.toString(8)} ${detail}`.trimEnd();
}

/**
 * Builds an empty in-memory disk that behaves like a small POSIX or Windows file system for the state ports.
 *
 * @param flavor - the path syntax of every path given to it
 * @returns the ports over one shared tree, with helpers to set a scene and to list the result
 */
export function createMemoryDisk(flavor: PathFlavor): MemoryDisk {
  const core = makeCore(flavor);
  const seedFolder = (folder: string): void => {
    const target = core.key(folder);
    if (core.isRoot(target) || core.nodes.get(target)?.kind === 'folder') return;
    seedFolder(core.parentOf(target));
    core.nodes.set(target, { kind: 'folder', id: core.clock.nextId, mode: 0o755, mtimeMs: core.clock.time });
    core.clock.nextId += 1;
  };
  const seed = (target: string, spec: NodeSpec): void => {
    seedFolder(core.parentOf(target));
    core.nodes.set(core.key(target), { ...spec, id: core.clock.nextId, mtimeMs: core.clock.time });
    core.clock.nextId += 1;
  };
  return {
    fs: buildFileSystem(core),
    links: buildLinks(core),
    probe: buildProbe(core),
    seedFolder,
    seedFile: (file, text) => seed(file, { kind: 'file', text, mode: 0o644 }),
    seedLink: (link, target) => seed(link, { kind: 'link', target, mode: 0o777 }),
    lockStoreAt: (lockPath) => buildLockStore(core, lockPath),
    setTime(milliseconds) {
      core.clock.time = milliseconds;
    },
    listing: () => [...core.nodes.entries()].map(([name, node]) => `${name} ${describe(node)}`).sort(),
  };
}
