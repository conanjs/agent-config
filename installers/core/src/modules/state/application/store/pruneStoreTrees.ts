// DR-202 step 10: delete the trees of `store/` older than the current and previous one of each component. A tree is removed as a
// whole; a link inside it is removed as a link and never followed.
import path from 'node:path';
import { treesToPrune, type StoreTree } from '#state/domain/store/pruneStore.ts';
import { containIn } from '#state/application/files/containIn.ts';
import type { StateDeps } from '#state/application/StateDeps.ts';

/**
 * Deletes the folders of `store/` that are neither the current nor the previous tree of their component.
 *
 * @param deps - the ports and roots
 * @param currentIds - component name to the `store_id` of its current tree
 * @returns the folder names that were deleted; an empty list when there is no store or nothing is old
 */
export function pruneStoreTrees(deps: StateDeps, currentIds: Readonly<Record<string, string>>): string[] {
  const flavored = path[deps.flavor];
  const storePath = flavored.join(deps.home, 'store');
  const store = containIn(deps, storePath, 'keep-link');
  if (!store.ok || deps.fs.stat(store.value)?.kind !== 'folder') return [];
  const trees: StoreTree[] = [];
  for (const folder of deps.fs.readDirectory(store.value)) {
    const tree = containIn(deps, flavored.join(storePath, folder), 'keep-link');
    const found = tree.ok ? deps.fs.stat(tree.value) : undefined;
    if (found?.kind === 'folder') trees.push({ folder, modifiedMs: found.mtimeMs });
  }
  const doomed = treesToPrune(trees, currentIds);
  for (const folder of doomed) {
    const tree = containIn(deps, flavored.join(storePath, folder), 'keep-link');
    if (tree.ok) deps.fs.remove(tree.value);
  }
  return doomed;
}
