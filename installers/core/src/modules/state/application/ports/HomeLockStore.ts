// The one file `install.lock` (M-12), as the HomeLock port of DR-305. It is a port of its own, not part of FileSystem, because the
// lock needs an exclusive create that no other write has and a check that refuses a link; the adapter holds the lock path.

/** What looking at the lock file found. */
export type LockFileRead =
  | { readonly kind: 'absent' }
  | { readonly kind: 'file'; readonly text: string; readonly modifiedMs: number }
  | { readonly kind: 'link' }
  | { readonly kind: 'unreadable' };

/** The lock file of one home. */
export interface HomeLockStore {
  /** The path of the lock file, printed by MG-30. */
  readonly path: string;

  /**
   * Creates the lock file exclusively and owner-only; a link or file already there is not touched.
   *
   * @param text - the lock record text
   * @returns `created`, or `exists` when something (a file, a link, a dangling link) is at the path
   */
  tryCreate(text: string): 'created' | 'exists';

  /**
   * Looks at the lock file without following a link.
   *
   * @returns what is there: nothing, a regular file with its text and time, a link, or something that cannot be read
   */
  read(): LockFileRead;

  /**
   * Deletes the lock file only while it still holds exactly this text, so a run never removes a lock another run took in between.
   *
   * @param text - the text the caller read or wrote
   * @returns `removed`, `changed` when the file now holds other text (left alone), or `absent`
   */
  removeIfSame(text: string): 'removed' | 'changed' | 'absent';

  /**
   * Replaces the text of the lock file by a temporary file and a rename, only while it still holds exactly the old text, so a lock that
   * another run took over is never overwritten.
   *
   * @param oldText - the text this run wrote or last wrote
   * @param newText - the new text, with a later start
   * @returns `replaced`, `changed` when the file now holds other text (left alone), or `absent`
   */
  replaceIfSame(oldText: string, newText: string): 'replaced' | 'changed' | 'absent';
}
