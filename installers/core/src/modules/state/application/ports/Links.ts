// Links as the state module uses them (DR-202, DR-305). The method names are the ones the fault adapter wraps. `switchLink` is the
// POSIX atomic switch (a temporary link, then a rename over the old one, tested on macOS: DR-202); on Windows it is not available and
// the application composes `removeLink` then `createLink`, which is one switch for the fault adapter too.
import type { CheckedPath } from '#state/application/ports/CheckedPath.ts';

/** What kind of link: a symbolic link, or a junction (Windows folders only). */
export type LinkKind = 'symlink' | 'junction';

/** The link operations of the state module. */
export interface Links {
  /**
   * Creates a link that must not exist yet.
   *
   * @param path - the checked path of the link
   * @param target - where it points
   * @param kind - the kind of link
   */
  createLink(path: CheckedPath, target: string, kind: LinkKind): void;

  /**
   * Removes a link, never what it points at; an error when the path is not a link.
   *
   * @param path - the checked path of the link (`keep-link` containment)
   */
  removeLink(path: CheckedPath): void;

  /**
   * Replaces an existing link with another in one step (POSIX: a temporary link beside it, renamed over it).
   *
   * @param path - the checked path of the link
   * @param target - the new target
   * @param kind - the kind of link
   */
  switchLink(path: CheckedPath, target: string, kind: LinkKind): void;

  /**
   * Reads where a link points.
   *
   * @param path - the checked path of the link
   * @returns the target as stored; an error when the path is not a link
   */
  readLink(path: CheckedPath): string;
}
