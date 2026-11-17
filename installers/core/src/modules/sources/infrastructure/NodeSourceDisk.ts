// The disk questions of the sources module on Node's file system (specs/022 T133). Only the composition root chooses it. Reads only.
import fs from 'node:fs';
import type { SourceDisk, SourceFolderState } from '#sources/application/ports/SourceDisk.ts';

// ENOENT and ENOTDIR are the only errors that mean "a part of the path is not there"; every other error means "not knowable".
function isAbsentError(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code;
  return code === 'ENOENT' || code === 'ENOTDIR';
}

/**
 * Builds the disk adapter of the sources module.
 *
 * @returns the folder and existence questions
 */
export function createNodeSourceDisk(): SourceDisk {
  return {
    folderState(folder: string): SourceFolderState {
      try {
        return fs.statSync(folder).isDirectory() ? 'folder' : 'not-folder';
      } catch (error) {
        return isAbsentError(error) ? 'missing' : 'unknown';
      }
    },
    exists(target: string): boolean | 'unknown' {
      try {
        fs.lstatSync(target);
        return true;
      } catch (error) {
        return isAbsentError(error) ? false : 'unknown';
      }
    },
  };
}
