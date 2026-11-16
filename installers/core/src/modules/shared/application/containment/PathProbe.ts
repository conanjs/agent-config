/** The answer to "what is the canonical form of this path": found, certainly not there, or not knowable. */
export type RealPathAnswer =
  { readonly kind: 'real'; readonly path: string } | { readonly kind: 'missing' } | { readonly kind: 'unknown' };

/** The answer to "is the last segment of this path a link": yes, certainly not, or not knowable. */
export type LinkAnswer = 'link' | 'not-link' | 'unknown';

/** The answer to "which file is this": its device and index number (the same for two paths that reach one folder), missing, or not knowable. */
export type IdentityAnswer =
  | { readonly kind: 'identity'; readonly dev: bigint; readonly ino: bigint }
  | { readonly kind: 'missing' }
  | { readonly kind: 'unknown' };

/**
 * The questions the real-path check asks the disk, owned by the application layer and answered by an adapter (DR-305).
 *
 * The real adapter (T132) uses `fs.realpathSync.native` for `realPath` and `fs.lstatSync` for `isLink`. `missing` and `not-link`
 * are the answers only for ENOENT and ENOTDIR (a part of the path is not there); every other error (EACCES, ELOOP, EIO,
 * ENAMETOOLONG, ...) is `unknown`, and the check then refuses the path ("cannot be checked") instead of guessing that it is
 * absent. Case: on a case-insensitive volume (APFS by default on macOS, NTFS) the check compares the canonical spellings that
 * `realpathSync.native` returns for the root and for the target; the JavaScript `fs.realpathSync` keeps the caller's spelling and
 * must not be used. Whether `.native` canonicalises letter case on APFS is not confirmed here: T132 must test it on a macOS
 * runner, because a root and a target spelled in two cases are compared as different on a `posix` flavor, which refuses the
 * path (the safe direction).
 *
 * `identity` is for comparing folders that text cannot compare: a firmlink or a bind mount gives one folder two paths
 * (`/System/Volumes/Data/Users/v` and `/Users/v`), and only the device and index number say they are the same (M-03). The real
 * adapter uses `fs.statSync(path, { bigint: true })` (links followed) and may call `nodeFileIdentity` of
 * `shared/infrastructure/nodeFileIdentity.ts`, which answers `missing` only for ENOENT and ENOTDIR.
 *
 * A double with a small table of links can stand in for any file system in a unit test.
 */
export interface PathProbe {
  /**
   * Gives the canonical form of a path, every link followed.
   *
   * @param path - an absolute path
   * @returns the canonical path; `missing` when nothing is there, including a link whose target is gone; `unknown` for any other error
   */
  realPath(path: string): RealPathAnswer;

  /**
   * Tells whether the last segment of a path is a link, without following it.
   *
   * @param path - an absolute path
   * @returns `link` for a link, working or dangling; `not-link` for anything else including a missing path; `unknown` on any other error
   */
  isLink(path: string): LinkAnswer;

  /**
   * Gives the identity of the file or folder a path reaches, every link followed.
   *
   * @param path - an absolute path
   * @returns device and index number; `missing` when nothing is there; `unknown` for any other error
   */
  identity(path: string): IdentityAnswer;
}
