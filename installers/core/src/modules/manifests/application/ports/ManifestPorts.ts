// The questions the manifests module asks the disk, owned here and answered by an adapter chosen at the composition root (DR-305,
// DR-609). Every question about a path goes through a `ContainedPath` or the shared `PathProbe`, so an unchecked string cannot
// reach the disk.
import type { ContainedPath } from '#shared/application/containment/resolveContainedPath.ts';
import type { PathProbe } from '#shared/application/containment/PathProbe.ts';

/** What reading a file gave. */
export type TextRead =
  | {
      readonly kind: 'text';
      /** The text; when `truncated`, only the first bytes up to one past the limit asked for. */
      readonly text: string;
      /** True when the file is longer than the limit, so the contract reader sees the oversize and refuses it (M-17). */
      readonly truncated: boolean;
    }
  | { readonly kind: 'missing' }
  | { readonly kind: 'unreadable' };

/** What a folder question gave: a folder, a thing that is not a folder, nothing there, or not knowable. */
export type FolderState = 'folder' | 'not-folder' | 'missing' | 'unknown';

/** What a checked path is on disk: a folder, a regular file, something else (a pipe, a device, a socket, a link), nothing, or not knowable. */
export type EntryKind = 'folder' | 'file' | 'other' | 'missing' | 'unknown';

/** What listing the links of a component folder gave. */
export type LinkListing =
  | { readonly kind: 'listed'; readonly links: readonly string[] }
  | { readonly kind: 'too-many' }
  | { readonly kind: 'unreadable' };

/** Reads single files and answers whether a folder is there. */
export interface ManifestFiles {
  /**
   * Reads one file whose real path was proven to stay under its root, never more than the limit plus one byte.
   *
   * @param file - the checked path of the file
   * @param maxBytes - the size above which the file is refused
   * @returns the text, `missing` for ENOENT or ENOTDIR, `unreadable` for any other error
   */
  readText(file: ContainedPath, maxBytes: number): TextRead;

  /**
   * Tells whether a path is a folder.
   *
   * @param folder - an absolute path
   * @returns `folder`, `not-folder` for a file or other thing, `missing` for ENOENT or ENOTDIR, `unknown` for any other error
   */
  folderState(folder: string): FolderState;

  /**
   * Tells what a checked path is, without following a link at its end.
   *
   * @param target - the checked path, already canonical
   * @returns `folder`, `file` (a regular file), `other` for a pipe, device, socket or link, `missing` for ENOENT or ENOTDIR, `unknown` for any other error
   */
  entryKind(target: ContainedPath): EntryKind;
}

/** Finds the links inside a component folder. */
export interface ComponentTree {
  /**
   * Lists every link in a folder tree without following any of them (the folder `.git` at the root is not entered).
   *
   * @param root - the absolute component root
   * @returns the paths of the links relative to the root with `/` separators, sorted; `too-many` when the tree is larger than the
   *   adapter's limit, so the answer would be partial
   */
  listLinks(root: string): LinkListing;
}

/** Everything the manifests module needs from the machine. */
export interface ManifestPorts {
  /** Answers where a path really is and whether it is a link. */
  readonly probe: PathProbe;
  /** Reads files and folders. */
  readonly files: ManifestFiles;
  /** Lists the links of a component. */
  readonly tree: ComponentTree;
}
