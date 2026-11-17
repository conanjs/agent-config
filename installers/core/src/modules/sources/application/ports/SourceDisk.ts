// The two questions the sources module asks the disk besides git (DR-305): is a folder there, and is a file there. Both only read.

/** What a path is: a folder, something else, nothing, or not knowable. */
export type SourceFolderState = 'folder' | 'not-folder' | 'missing' | 'unknown';

/** Answers the questions the sources module has about folders and files. */
export interface SourceDisk {
  /**
   * Tells whether a path is a folder, links followed.
   *
   * @param folder - an absolute path
   * @returns `folder`, `not-folder`, `missing` for ENOENT or ENOTDIR, `unknown` for any other error
   */
  folderState(folder: string): SourceFolderState;

  /**
   * Tells whether something is at a path, without following a link at its end.
   *
   * @param target - an absolute path
   * @returns true when a file, folder or link is there; false for ENOENT or ENOTDIR; `unknown` for any other error
   */
  exists(target: string): boolean | 'unknown';
}
