import path from 'node:path';
import type { ManifestDeps } from '#manifests/application/ManifestDeps.ts';
import { isSameOrInside } from '#shared/domain/path/PathContainment.ts';

/** What looking at the links of a component folder found. */
export type LinkCheck =
  { readonly kind: 'clean' } | { readonly kind: 'escapes'; readonly link: string } | { readonly kind: 'unchecked' };

/**
 * Finds the first link in a component folder whose real path leaves the folder (M-04). A link that points at nothing, or that
 * cannot be resolved, counts as leaving, because a later write or read through it would follow it to wherever it ends up.
 *
 * `doctor` calls this for a linked `path` source (S-7); the component reader calls it for every component.
 *
 * @param deps - the ports, path syntax and git policy of the run
 * @param root - the absolute component root
 * @returns `clean`, the first offending link relative to the root in sorted order, or `unchecked` when the folder could not be
 *   listed completely (too many entries, or a read error), so the answer would not be trustworthy
 */
export function findEscapingLinks(deps: ManifestDeps, root: string): LinkCheck {
  const { probe, tree } = deps.ports;
  const flavored = path[deps.flavor];
  const listing = tree.listLinks(root);
  if (listing.kind !== 'listed') return { kind: 'unchecked' };
  const realRoot = probe.realPath(root);
  if (realRoot.kind !== 'real') return { kind: 'unchecked' };
  const leaving = listing.links.find((link) => {
    const real = probe.realPath(flavored.join(root, ...link.split('/')));
    return real.kind !== 'real' || !isSameOrInside(realRoot.path, real.path, deps.flavor);
  });
  return leaving === undefined ? { kind: 'clean' } : { kind: 'escapes', link: leaving };
}
