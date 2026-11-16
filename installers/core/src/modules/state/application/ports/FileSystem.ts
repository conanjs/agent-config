// The file system as the state module uses it (DR-305), owned here and answered by an adapter: NodeFileSystem in production,
// MemoryDisk for a dry run and for unit tests. The method names are the ones the fault adapter of the scenario layer wraps
// (its port spec): writes are writeFile, appendFile, makeDirectory, rename, remove, copyTree and setMode; the rest
// only read. Every method is synchronous and takes only checked paths. A failure is a thrown error with a `code` (`EEXIST`, `EIO`...).
import type { CheckedPath } from '#state/application/ports/CheckedPath.ts';

/** What `stat` found at a path, without following a link at its end. */
export interface FileStat {
  /** A regular file, a folder, a link (working or dangling), or anything else (pipe, device, socket). */
  readonly kind: 'file' | 'folder' | 'link' | 'other';
  /** The size in bytes. */
  readonly size: number;
  /** The modification time in milliseconds since the epoch. */
  readonly mtimeMs: number;
  /** The permission bits (for example 0o600); meaningless on Windows. */
  readonly mode: number;
}

/** The file operations of the state module. */
export interface FileSystem {
  /**
   * Creates a new file that nobody else can have created first: an exclusive create (`wx`), owner-only (0600), never following a link.
   *
   * @param path - the checked path, which must not exist
   * @param text - the content, written as UTF-8
   * @throws an error with code `EEXIST` when the path exists
   */
  writeFile(path: CheckedPath, text: string): void;

  /**
   * Appends text to a file, creating it owner-only (0600) when it is missing; a link at the path is refused.
   *
   * @param path - the checked path
   * @param text - the text to add
   */
  appendFile(path: CheckedPath, text: string): void;

  /**
   * Creates one folder, owner-only (0700), whose parent exists; never recursive.
   *
   * @param path - the checked path
   * @returns `created`, or `existed` when a folder is already there (anything else there is an error)
   */
  makeDirectory(path: CheckedPath): 'created' | 'existed';

  /**
   * Moves a file or folder onto a name in one step, replacing a file that is there (a link at the end is replaced, not followed).
   *
   * @param from - the checked path to move
   * @param to - the checked path to move it to
   */
  rename(from: CheckedPath, to: CheckedPath): void;

  /**
   * Deletes a file, a link or a folder with its content. A link is deleted as a link: its target is never touched.
   *
   * @param path - the checked path; an error when nothing is there
   */
  remove(path: CheckedPath): void;

  /**
   * Copies a file or folder tree; links inside are copied as links, never followed. The copy keeps the source's modes.
   *
   * @param from - the checked path to copy
   * @param to - the checked path of the copy, which must not exist
   */
  copyTree(from: CheckedPath, to: CheckedPath): void;

  /**
   * Sets the permission bits of a file or folder (a no-op on Windows, where the access list is the guard, A-30).
   *
   * @param path - the checked path
   * @param mode - for example 0o700
   */
  setMode(path: CheckedPath, mode: number): void;

  /**
   * Reads a file as UTF-8, refusing one longer than 16 MiB.
   *
   * @param path - the checked path
   * @returns the text
   */
  readFile(path: CheckedPath): string;

  /**
   * Lists the names in a folder.
   *
   * @param path - the checked path of a folder
   * @returns the names, sorted, without `.` and `..`
   */
  readDirectory(path: CheckedPath): string[];

  /**
   * Tells what is at a path without following a link at its end.
   *
   * @param path - the checked path
   * @returns the facts, or `undefined` when nothing is there (ENOENT or ENOTDIR); any other error is thrown
   */
  stat(path: CheckedPath): FileStat | undefined;

  /**
   * Tells whether something is at a path, a dangling link included.
   *
   * @param path - the checked path
   * @returns true when something is there
   */
  exists(path: CheckedPath): boolean;

  /**
   * Gives the canonical form of a path, every link followed (`fs.realpathSync.native`).
   *
   * @param path - the checked path
   * @returns the canonical path; an error when nothing is there
   */
  realPath(path: CheckedPath): string;
}
