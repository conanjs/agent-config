// The composer of the manifests module (MOD-11): it binds the use cases to the ports and settings the composition root gives it,
// and imports no adapter. src/CompositionRoot.ts (T142) builds `ManifestDeps` from `createNodeManifestPorts()`, the platform's path
// syntax and its git policy, then passes the result to the commands.
import type { ManifestDeps } from '#manifests/application/ManifestDeps.ts';
import type { ManifestsApi } from '#manifests/application/ManifestsApi.ts';
import { findEscapingLinks } from '#manifests/application/read/findEscapingLinks.ts';
import { readComponent } from '#manifests/application/read/readComponent.ts';
import { readComponentList } from '#manifests/application/read/readComponentList.ts';
import { readSlots } from '#manifests/application/read/readSlots.ts';

/**
 * Binds the manifests use cases to the ports, path syntax and git policy of one run.
 *
 * @param deps - what the composition root chose
 * @returns the functions the commands call
 */
export function composeManifests(deps: ManifestDeps): ManifestsApi {
  return {
    readSlots: (request) => readSlots(deps, request),
    readComponentList: (request) => readComponentList(deps, request),
    readComponent: (request) => readComponent(deps, request),
    findEscapingLinks: (root) => findEscapingLinks(deps, root),
  };
}
