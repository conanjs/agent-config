import fs from 'node:fs';
import type { HomeLockStore, LockFileRead } from '#state/application/ports/HomeLockStore.ts';

const MAX_LOCK_BYTES = 4097;

/**
 * The real lock file: an exclusive create (`wx`, owner-only), a read that refuses a link (O_NOFOLLOW and lstat), and a remove that
 * checks the text it removes.
 *
 * @param lockPath - where `install.lock` lies; the path is inside the home that `createHome` checked
 * @returns a store bound to that one path
 */
export function fileHomeLockStore(lockPath: string): HomeLockStore {
  const read = (): LockFileRead => {
    try {
      const found = fs.lstatSync(lockPath);
      if (found.isSymbolicLink()) return { kind: 'link' };
      if (!found.isFile()) return { kind: 'unreadable' };
      const descriptor = fs.openSync(lockPath, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0));
      try {
        const buffer = Buffer.alloc(MAX_LOCK_BYTES);
        const count = fs.readSync(descriptor, buffer, 0, MAX_LOCK_BYTES, 0);
        return { kind: 'file', text: buffer.toString('utf8', 0, count), modifiedMs: found.mtimeMs };
      } finally {
        fs.closeSync(descriptor);
      }
    } catch (error) {
      return (error as NodeJS.ErrnoException).code === 'ENOENT' ? { kind: 'absent' } : { kind: 'unreadable' };
    }
  };
  return {
    path: lockPath,
    tryCreate(text) {
      try {
        fs.writeFileSync(lockPath, text, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
        return 'created';
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'EEXIST') return 'exists';
        throw error;
      }
    },
    read,
    removeIfSame(text) {
      const seen = read();
      if (seen.kind === 'absent') return 'absent';
      if (seen.kind !== 'file' || seen.text !== text) return 'changed';
      fs.unlinkSync(lockPath);
      return 'removed';
    },
  };
}
