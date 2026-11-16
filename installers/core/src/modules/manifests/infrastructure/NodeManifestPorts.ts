// The adapters of the manifests ports on Node's file system (specs/022 T131). Only the composition root chooses them (DR-609, MOD-11).
// Every question is synchronous and reads only; nothing here writes, and no path is followed unless the caller proved it contained.
import fs from 'node:fs';
import path from 'node:path';
import type {
  ComponentTree,
  EntryKind,
  FolderState,
  LinkListing,
  ManifestFiles,
  ManifestPorts,
  TextRead,
} from '#manifests/application/ports/ManifestPorts.ts';
import type {
  IdentityAnswer,
  LinkAnswer,
  PathProbe,
  RealPathAnswer,
} from '#shared/application/containment/PathProbe.ts';
import type { ContainedPath } from '#shared/application/containment/resolveContainedPath.ts';

/** The most entries (files, folders and links) the link listing looks at before it answers `too-many`. */
export const MAX_TREE_ENTRIES = 50_000;

// ENOENT and ENOTDIR are the only errors that mean "a part of the path is not there"; every other error means "not knowable".
function isAbsentError(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code;
  return code === 'ENOENT' || code === 'ENOTDIR';
}

// `.native` is the one that gives the canonical spelling on a case-insensitive volume (see PathProbe); T132 tests it on macOS.
// Device and index number of what a path reaches, links followed (a firmlink or a bind mount gives one folder two paths, M-03).
// Written here and not taken from shared/infrastructure, which no other module may use (MOD-3).
function fileIdentity(target: string): IdentityAnswer {
  try {
    const stats = fs.statSync(target, { bigint: true });
    return { kind: 'identity', dev: stats.dev, ino: stats.ino };
  } catch (error) {
    return isAbsentError(error) ? { kind: 'missing' } : { kind: 'unknown' };
  }
}

const nodePathProbe: PathProbe = {
  identity: fileIdentity,
  realPath(target: string): RealPathAnswer {
    try {
      return { kind: 'real', path: fs.realpathSync.native(target) };
    } catch (error) {
      return isAbsentError(error) ? { kind: 'missing' } : { kind: 'unknown' };
    }
  },
  isLink(target: string): LinkAnswer {
    try {
      return fs.lstatSync(target).isSymbolicLink() ? 'link' : 'not-link';
    } catch (error) {
      return isAbsentError(error) ? 'not-link' : 'unknown';
    }
  },
};

// O_NONBLOCK makes opening a named pipe return at once instead of waiting for a writer, so a hostile `component.yaml` that is a
// pipe cannot hang the run; the open file is then checked to be a regular file. Windows has no such flag and no such file.
const OPEN_FLAGS = fs.constants.O_RDONLY | (fs.constants.O_NONBLOCK ?? 0);

function readRegularFile(target: string, maxBytes: number): TextRead {
  let descriptor: number | undefined;
  try {
    descriptor = fs.openSync(target, OPEN_FLAGS);
    if (!fs.fstatSync(descriptor).isFile()) return { kind: 'unreadable' };
    const buffer = Buffer.alloc(maxBytes);
    let filled = 0;
    while (filled < maxBytes) {
      const count = fs.readSync(descriptor, buffer, filled, maxBytes - filled, null);
      if (count === 0) break;
      filled += count;
    }
    return { kind: 'text', text: buffer.toString('utf8', 0, filled), truncated: filled === maxBytes };
  } catch (error) {
    return isAbsentError(error) ? { kind: 'missing' } : { kind: 'unreadable' };
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor);
  }
}

const nodeManifestFiles: ManifestFiles = {
  readText(file: ContainedPath, maxBytes: number): TextRead {
    return readRegularFile(file.realPath, maxBytes);
  },
  entryKind(target: ContainedPath): EntryKind {
    try {
      const stat = fs.lstatSync(target.realPath);
      if (stat.isDirectory()) return 'folder';
      return stat.isFile() ? 'file' : 'other';
    } catch (error) {
      return isAbsentError(error) ? 'missing' : 'unknown';
    }
  },
  folderState(folder: string): FolderState {
    try {
      return fs.statSync(folder).isDirectory() ? 'folder' : 'not-folder';
    } catch (error) {
      return isAbsentError(error) ? 'missing' : 'unknown';
    }
  },
};

// A walk with an explicit stack, so a deep tree cannot overflow the call stack. A link is recorded and never entered. The folder
// `.git` at the root is not entered: a working copy of a path source has one, and nothing in it is ever read or rendered.
// Not confirmed: whether Node reports a Windows junction as a link here; T132 tests links on the Windows runner.
function walkLinks(root: string): LinkListing {
  const links: string[] = [];
  const pending: string[] = [''];
  let seen = 0;
  while (pending.length > 0) {
    const relative = pending.pop() ?? '';
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(path.join(root, relative), { withFileTypes: true });
    } catch {
      // Any read error means the listing would be partial, which the caller treats as "cannot check" (fail closed).
      return { kind: 'unreadable' };
    }
    for (const entry of entries) {
      seen += 1;
      if (seen > MAX_TREE_ENTRIES) return { kind: 'too-many' };
      const child = relative === '' ? entry.name : `${relative}/${entry.name}`;
      if (entry.isSymbolicLink()) links.push(child);
      else if (entry.isDirectory() && child !== '.git') pending.push(child);
    }
  }
  return { kind: 'listed', links: links.sort() };
}

const nodeComponentTree: ComponentTree = { listLinks: walkLinks };

/**
 * Builds the manifests ports on Node's file system. Called only by the composition root.
 *
 * @returns the probe, file reader and link lister
 */
export function createNodeManifestPorts(): ManifestPorts {
  return { probe: nodePathProbe, files: nodeManifestFiles, tree: nodeComponentTree };
}
