import type {
  GitAcquireRequest,
  GitAcquireResult,
  PathAcquireRequest,
  PathAcquireResult,
} from '#sources/domain/model/Acquisition.ts';

/**
 * What the sources module offers the commands: the two source adapters of this release (`archive` is refused before it gets here,
 * AC-3.7), with the git program and the disk reached only through the module's ports. Built by `composeSources` in SourcesModule.ts.
 */
export interface SourcesApi {
  /**
   * Brings the managed clone of a git source to the commit this run uses.
   *
   * @param request - the component, address, ref, clone folder, lock entry and whether this is `install --update`
   * @returns the commit now checked out, or why the source could not be used
   */
  acquireGit(request: GitAcquireRequest): Promise<GitAcquireResult>;

  /**
   * Confirms that the folder of a `path` source is there, so it can be linked live.
   *
   * @param request - the component name and the folder as the list wrote it
   * @returns the folder, or that it is missing
   */
  acquirePath(request: PathAcquireRequest): PathAcquireResult;

  /**
   * Tells whether a linked folder is in a git working copy, for the `doctor` warning.
   *
   * @param folder - the absolute folder of a `path` source
   * @returns true, false, or `unknown`
   */
  isVersionControlled(folder: string): boolean | 'unknown';
}
