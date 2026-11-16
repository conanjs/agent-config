import path from 'node:path';
import type { ManifestDeps } from '#manifests/application/ManifestDeps.ts';
import { checkHoldsNoProtectedFolder, checkHomeIdentity } from '#shared/application/containment/homeIdentity.ts';

/** The two folders a `path` source must keep away from, as the composition root knows them. */
export interface PathSourceGuard {
  /** The user's own home folder: a source may not be it, or a folder that holds it, the file system root included. */
  readonly userHome: string;
  /** The agent home: a source may not be it or lie inside it. */
  readonly agentHome: string;
}

// The folder itself and every folder above it, nearest first.
function selfAndAncestors(folder: string, deps: ManifestDeps): string[] {
  const flavored = path[deps.flavor];
  const folders: string[] = [];
  for (let current = folder; ; current = flavored.dirname(current)) {
    folders.push(current);
    if (flavored.dirname(current) === current) return folders;
  }
}

/**
 * Checks a `path` source folder against the user's home and the agent home, including a folder that holds either, by file identity, so a link, a firmlink or a mount that
 * reaches the same folder by another path is caught as well (M-03). Linking `/`, the user's home or a folder that holds it would
 * expose far more than a component, and linking the agent home would make the installer's own files a component's.
 *
 * @param deps - the ports, path syntax and git policy of the run
 * @param folder - the absolute folder the list names, which exists
 * @param guard - the user's home and the agent home
 * @returns the reason the folder is refused (it completes `path source folder X is refused: <reason>`), or `undefined` when it is acceptable
 */
export function pathSourceProblem(deps: ManifestDeps, folder: string, guard: PathSourceGuard): string | undefined {
  const { probe } = deps.ports;
  // 1. Not the user's home, and not a folder above it (the file system root is one).
  const home = checkHomeIdentity(folder, guard.userHome, deps.flavor, probe);
  if (!home.ok) return home.error;
  // 2. Not the agent home, and not inside it: compare the identity of the folder and each folder above it with the agent home's.
  const agent = probe.identity(guard.agentHome);
  if (agent.kind === 'unknown') return 'it cannot be checked against the agent home';
  if (agent.kind === 'missing') return undefined;
  const real = probe.realPath(folder);
  if (real.kind !== 'real') return 'path source refused: it cannot be checked against the agent home';
  const inside = selfAndAncestors(real.path, deps).some((each) => {
    const answer = probe.identity(each);
    return (
      answer.kind === 'unknown' || (answer.kind === 'identity' && answer.dev === agent.dev && answer.ino === agent.ino)
    );
  });
  if (inside) return 'it is the agent home or inside it';
  // 3. Not a folder that holds the agent home under a path text cannot relate to it (a link or a firmlink on the way down).
  const agentReal = probe.realPath(guard.agentHome);
  if (agentReal.kind !== 'real') return 'it cannot be checked against the agent home';
  const holds = checkHoldsNoProtectedFolder(folder, agentReal.path, agent, deps.flavor, probe);
  return holds.ok ? undefined : 'it holds the agent home, reached by another path';
}
