// M-03, M-04: every path that reaches a state port is the real path of a `ContainedPath`, proven to stay under its root. The brand
// means a plain string cannot be handed to a port by mistake; at run time it is an ordinary string, so the fault adapter of the
// scenario layer, which looks at string arguments, sees it as it always did.
import type { ContainedPath } from '#shared/application/containment/resolveContainedPath.ts';

/** A path that `resolveContainedPath` proved to stay under its root, as the string the ports take. */
export type CheckedPath = string & { readonly checkedAs: 'CheckedPath' };

/**
 * Takes the checked text out of a contained path.
 *
 * @param contained - a path proven to stay under its root
 * @returns its real path, branded
 */
export function checkedPathOf(contained: ContainedPath): CheckedPath {
  return contained.realPath as CheckedPath;
}
