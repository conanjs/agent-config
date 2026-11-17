import path from 'node:path';
import type { SourcesDeps } from '#sources/application/SourcesDeps.ts';
import type { PathAcquireRequest, PathAcquireResult } from '#sources/domain/model/Acquisition.ts';

/**
 * Checks that the folder of a `path` source is there; the source is linked live with no copy and the lock records `live` (AC-3.2).
 * A folder that moved is an error, not a skip, and earlier links stay (AC-3.3).
 *
 * @param deps - the git program, the disk, the git policy and the path syntax
 * @param request - the component name and the folder as the list wrote it
 * @returns the folder as written, or that it is missing
 */
export function acquirePath(deps: SourcesDeps, request: PathAcquireRequest): PathAcquireResult {
  const state = deps.disk.folderState(request.path);
  return state === 'folder'
    ? { kind: 'acquired', name: request.name, path: request.path }
    : { kind: 'missing', name: request.name, folder: request.path };
}

/**
 * Tells whether a folder is inside a git working copy, by looking for `.git` in the folder and above it; no git program runs on a
 * linked folder (M-06). `doctor` warns when it is not (AC-3.2, AC-7.5).
 *
 * @param deps - the git program, the disk, the git policy and the path syntax
 * @param folder - the absolute folder of a `path` source
 * @returns true when a `.git` entry is found; `unknown` when a folder on the way could not be read
 */
export function isVersionControlled(deps: SourcesDeps, folder: string): boolean | 'unknown' {
  const flavored = path[deps.flavor];
  for (let current = folder; ; current = flavored.dirname(current)) {
    const found = deps.disk.exists(flavored.join(current, '.git'));
    if (found !== false) return found;
    if (flavored.dirname(current) === current) return false;
  }
}
