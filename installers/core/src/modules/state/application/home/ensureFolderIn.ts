// A folder that a command needs to exist before it links into it (Copilot's home on a machine that has none). Only a folder inside the
// agent home, the backups folder or one of the agent folders may be made, and each level is made and checked one at a time.
import path from 'node:path';
import { isSameOrInside } from '#shared/domain/path/PathContainment.ts';
import { refuse, type Result } from '#shared/domain/result/Result.ts';
import { ensureFolder, type EnsureRefusal } from '#state/application/home/ensureFolder.ts';
import type { StateDeps } from '#state/application/StateDeps.ts';

/**
 * Makes a folder, with its missing levels, owner-only, when it is one of the roots or inside one.
 *
 * @param deps - the ports and roots
 * @param folder - the absolute folder to make
 * @returns `created` or `existed`, or why the folder was refused (outside every root, or a level could not be checked)
 */
export function ensureFolderIn(deps: StateDeps, folder: string): Result<'created' | 'existed', EnsureRefusal> {
  const flavored = path[deps.flavor];
  const inside = [deps.home, deps.backups, ...deps.roots].some((root) =>
    isSameOrInside(root, flavored.normalize(folder), deps.flavor),
  );
  return inside
    ? ensureFolder(deps, folder)
    : refuse({ reason: 'the folder is not inside the agent home or an agent folder' });
}
