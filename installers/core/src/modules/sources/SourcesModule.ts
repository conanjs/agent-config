// The composer of the sources module (MOD-11): it binds the use cases to the ports and settings the composition root gives it and
// imports no adapter. src/CompositionRoot.ts (T142) builds `SourcesDeps` from `createNodeGit(policy)` and `createNodeSourceDisk()`.
import { acquireGit } from '#sources/application/git/acquireGit.ts';
import { acquirePath, isVersionControlled } from '#sources/application/path/acquirePath.ts';
import type { SourcesApi } from '#sources/application/SourcesApi.ts';
import type { SourcesDeps } from '#sources/application/SourcesDeps.ts';

/**
 * Binds the sources use cases to the ports, git policy and path syntax of one run.
 *
 * @param deps - what the composition root chose
 * @returns the functions the commands call
 */
export function composeSources(deps: SourcesDeps): SourcesApi {
  return {
    acquireGit: (request) => acquireGit(deps, request),
    acquirePath: (request) => acquirePath(deps, request),
    isVersionControlled: (folder) => isVersionControlled(deps, folder),
  };
}
