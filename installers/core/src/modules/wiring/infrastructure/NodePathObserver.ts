import fs from 'node:fs';
import type { PathObserver } from '#wiring/application/ports/PathObserver.ts';

const ABSENT = new Set(['ENOENT', 'ENOTDIR']);

/** The real observer: `lstat` and `readlink`, so a link is seen as a link and never followed. Changes nothing. */
export const nodePathObserver: PathObserver = {
  observe(target) {
    try {
      const found = fs.lstatSync(target);
      if (found.isSymbolicLink()) return { kind: 'link', target: fs.readlinkSync(target) };
      if (found.isDirectory()) return { kind: 'folder' };
      return { kind: found.isFile() ? 'file' : 'other' };
    } catch (error) {
      // Only "not there" is an answer; any other error (permission, a loop) is `unknown`, and the plan then skips the path.
      return ABSENT.has((error as NodeJS.ErrnoException).code ?? '') ? { kind: 'absent' } : { kind: 'unknown' };
    }
  },
};
