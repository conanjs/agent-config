// Store pruning (DR-202 step 10, data-model StoreTree): `store/<name>@<id>/` keeps the current tree and the previous one of each
// component; older trees go. Pure: the caller lists the folders and passes their times.
const TREE_NAME = /^([a-z0-9][a-z0-9-]{0,63})@([0-9a-f]{12})$/;

/** One folder of `store/`. */
export interface StoreTree {
  /** The folder name, `<name>@<id>`. */
  readonly folder: string;
  /** Its modification time, used to find the previous tree of a component. */
  readonly modifiedMs: number;
}

/**
 * Picks the store folders to delete: for each component, every tree except the current one and the newest of the others.
 *
 * A folder whose name is not `<name>@<12 hex>` is never picked, so nothing V put there is removed. A component with no current tree
 * (it left the lists) keeps its newest tree only.
 *
 * @param trees - the folders of `store/`
 * @param currentIds - component name to the `store_id` of its current tree, from `components.lock`
 * @returns the folder names to delete, sorted
 */
export function treesToPrune(trees: readonly StoreTree[], currentIds: Readonly<Record<string, string>>): string[] {
  const byComponent = new Map<string, { folder: string; id: string; modifiedMs: number }[]>();
  for (const tree of trees) {
    const match = TREE_NAME.exec(tree.folder);
    if (match?.[1] === undefined || match[2] === undefined) continue;
    const group = byComponent.get(match[1]) ?? [];
    group.push({ folder: tree.folder, id: match[2], modifiedMs: tree.modifiedMs });
    byComponent.set(match[1], group);
  }
  const doomed: string[] = [];
  for (const [component, group] of byComponent) {
    const others = group
      .filter((tree) => tree.id !== currentIds[component])
      .sort((left, right) => right.modifiedMs - left.modifiedMs || (left.folder < right.folder ? -1 : 1));
    doomed.push(...others.slice(1).map((tree) => tree.folder));
  }
  return doomed.sort();
}
