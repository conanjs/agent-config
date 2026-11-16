import fs from 'node:fs';
import type { FileStat, FileSystem } from '#state/application/ports/FileSystem.ts';

const MAX_READ_BYTES = 16 * 1024 * 1024;
const ABSENT = new Set(['ENOENT', 'ENOTDIR']);

function kindOf(stats: fs.Stats): FileStat['kind'] {
  if (stats.isSymbolicLink()) return 'link';
  if (stats.isFile()) return 'file';
  return stats.isDirectory() ? 'folder' : 'other';
}

/**
 * The real file system for the state module: sync `node:fs`, exclusive creates, owner-only modes, links never followed at the end of
 * a path. It takes only checked paths; containment is the application's job (`containIn`).
 */
export const nodeFileSystem: FileSystem = {
  writeFile(path, text) {
    // `wx` fails when anything is there, a link or a dangling link included; 0o600 is owner-only (M-10).
    fs.writeFileSync(path, text, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
  },
  appendFile(path, text) {
    // O_NOFOLLOW refuses a link at the log path; the mode applies only when the file is created.
    const flags = fs.constants.O_WRONLY | fs.constants.O_APPEND | fs.constants.O_CREAT | (fs.constants.O_NOFOLLOW ?? 0);
    const descriptor = fs.openSync(path, flags, 0o600);
    try {
      fs.writeSync(descriptor, text);
    } finally {
      fs.closeSync(descriptor);
    }
  },
  makeDirectory(path) {
    try {
      fs.mkdirSync(path, { mode: 0o700 });
      return 'created';
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EEXIST' && fs.lstatSync(path).isDirectory()) return 'existed';
      throw error;
    }
  },
  rename(from, to) {
    fs.renameSync(from, to);
  },
  remove(path) {
    // rmSync works on the path as lstat sees it: a link is removed as a link and its target is not followed.
    fs.rmSync(path, { recursive: true, force: false });
  },
  copyTree(from, to) {
    fs.cpSync(from, to, {
      recursive: true,
      force: false,
      errorOnExist: true,
      dereference: false,
      verbatimSymlinks: true,
    });
  },
  setMode(path, mode) {
    if (process.platform !== 'win32') fs.chmodSync(path, mode);
  },
  readFile(path) {
    const size = fs.statSync(path).size;
    if (size > MAX_READ_BYTES) throw new RangeError('the file is longer than the 16 MiB limit');
    return fs.readFileSync(path, 'utf8');
  },
  readDirectory(path) {
    return fs.readdirSync(path).sort();
  },
  stat(path) {
    try {
      const stats = fs.lstatSync(path);
      return { kind: kindOf(stats), size: stats.size, mtimeMs: stats.mtimeMs, mode: stats.mode & 0o777 };
    } catch (error) {
      if (ABSENT.has((error as NodeJS.ErrnoException).code ?? '')) return undefined;
      throw error;
    }
  },
  exists(path) {
    try {
      fs.lstatSync(path);
      return true;
    } catch (error) {
      if (ABSENT.has((error as NodeJS.ErrnoException).code ?? '')) return false;
      throw error;
    }
  },
  realPath(path) {
    return fs.realpathSync.native(path);
  },
};
