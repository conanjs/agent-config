// The two kinds of folder under the home that the installer creates for a git source and may delete again (DR-202): a store tree
// `store/<name>@<id>/` (one immutable tree per version, copied from the managed clone) and the managed clone `components/<name>/`
// (a fetch cache). Both are built from a name and an id the caller checked, and a delete accepts only a folder of exactly these two
// shapes directly under the home, so a path that merely sits under the home is never removed (M-03).
import path from 'node:path';
import { refuse, succeed, type Result } from '#shared/domain/result/Result.ts';
import { containIn } from '#state/application/files/containIn.ts';
import type { CheckedPath } from '#state/application/ports/CheckedPath.ts';
import { ensureFolder } from '#state/application/home/ensureFolder.ts';
import type { StateDeps } from '#state/application/StateDeps.ts';

const COMPONENT_NAME = /^[a-z0-9][a-z0-9-]{0,63}$/;
const STORE_ID = /^[0-9a-f]{12}$/;
const GIT_FOLDER = '.git';

/** Why a store tree or a clone was not made or removed. */
export interface ManagedTreeRefusal {
  /** `bad-name`: the name or id is not one the store uses. `outside`: a path leaves the home. `not-a-folder`: the source is not a folder. */
  readonly kind: 'bad-name' | 'outside' | 'not-a-folder';
  /** One sentence, never repeating a path. */
  readonly reason: string;
}

/** What to copy into the store. */
export interface StageRequest {
  /** The absolute folder to copy, the managed clone `components/<name>` of this run. */
  readonly from: string;
  /** The component name. */
  readonly name: string;
  /** The 12 hex characters that name the tree (DR-202). */
  readonly id: string;
}

/** The result of staging a tree. */
export interface StagedTree {
  /** `staged` when this call made the tree, `exists` when the same tree was there already (a tree is immutable, so it is reused). */
  readonly how: 'staged' | 'exists';
  /** The absolute folder of the tree. */
  readonly folder: string;
}

function badName(): ManagedTreeRefusal {
  return { kind: 'bad-name', reason: 'the component name or the store id is not valid' };
}

// The paths a staging touches, each proven to stay under the home: the tree, its temporary copy and the clone it comes from.
interface StagePaths {
  readonly final: string;
  readonly target: CheckedPath;
  readonly partial: CheckedPath;
  readonly source: CheckedPath;
}

function stagePaths(deps: StateDeps, request: StageRequest): Result<StagePaths, ManagedTreeRefusal> {
  const flavored = path[deps.flavor];
  const store = flavored.join(deps.home, 'store');
  const final = flavored.join(store, `${request.name}@${request.id}`);
  const ensured = ensureFolder(deps, store);
  if (!ensured.ok) return refuse({ kind: 'outside', reason: ensured.error.reason });
  const target = containIn(deps, final, 'keep-link');
  const partial = containIn(deps, `${final}.partial`, 'keep-link');
  const source = containIn(deps, request.from, 'follow-link');
  if (!target.ok || !partial.ok || !source.ok) {
    return refuse({ kind: 'outside', reason: 'the path is not inside the agent home or an agent folder' });
  }
  return succeed({ final, target: target.value, partial: partial.value, source: source.value });
}

/**
 * Copies the checked-out clone of a component into `store/<name>@<id>/`, without its `.git` folder, by a copy under a temporary name
 * and a rename, so a tree that exists is always complete. A tree that is there already is reused untouched.
 *
 * @param deps - the ports and roots
 * @param request - the clone to copy, the component name and the store id
 * @returns the tree and whether this call made it, or why it was refused; a failure of the disk is thrown and may leave one
 *   `.partial` folder, which the next call for the same tree removes first
 */
export function stageStoreTree(deps: StateDeps, request: StageRequest): Result<StagedTree, ManagedTreeRefusal> {
  if (!COMPONENT_NAME.test(request.name) || !STORE_ID.test(request.id)) return refuse(badName());
  const paths = stagePaths(deps, request);
  if (!paths.ok) return paths;
  const { final, target, partial, source } = paths.value;
  if (deps.fs.exists(target)) return succeed({ how: 'exists', folder: final });
  if (deps.fs.stat(source)?.kind !== 'folder') {
    return refuse({ kind: 'not-a-folder', reason: 'the folder to copy is not there' });
  }
  if (deps.fs.exists(partial)) deps.fs.remove(partial);
  deps.fs.copyTree(source, partial);
  const git = containIn(deps, path[deps.flavor].join(`${final}.partial`, GIT_FOLDER), 'keep-link');
  if (git.ok && deps.fs.exists(git.value)) deps.fs.remove(git.value);
  deps.fs.rename(partial, target);
  return succeed({ how: 'staged', folder: final });
}

/** Which folder to delete: a store tree of this component and id, or the managed clone of this component. */
export type ManagedFolder =
  | { readonly area: 'store'; readonly name: string; readonly id: string }
  | { readonly area: 'components'; readonly name: string };

/**
 * Deletes one store tree or one managed clone, as a whole; a link inside is removed as a link and never followed.
 *
 * Used for a tree this run staged when a check fails (so the previous version stays the only one), and for the clone of a component
 * that left both lists (EDGE-6).
 *
 * @param deps - the ports and roots
 * @param folder - which tree or clone
 * @returns `removed`, `absent` when nothing is there, or why the folder was refused
 */
export function removeManagedFolder(
  deps: StateDeps,
  folder: ManagedFolder,
): Result<'removed' | 'absent', ManagedTreeRefusal> {
  if (!COMPONENT_NAME.test(folder.name) || (folder.area === 'store' && !STORE_ID.test(folder.id))) {
    return refuse(badName());
  }
  const flavored = path[deps.flavor];
  const leaf = folder.area === 'store' ? `${folder.name}@${folder.id}` : folder.name;
  const checked = containIn(deps, flavored.join(deps.home, folder.area, leaf), 'keep-link');
  if (!checked.ok) return refuse({ kind: 'outside', reason: checked.error.reason });
  if (deps.fs.stat(checked.value) === undefined) return succeed('absent');
  deps.fs.remove(checked.value);
  return succeed('removed');
}
