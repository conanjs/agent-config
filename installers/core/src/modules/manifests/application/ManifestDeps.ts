import type { ManifestPorts } from '#manifests/application/ports/ManifestPorts.ts';
import type { GitPolicy } from '#manifests/domain/rules/GitPolicy.ts';
import type { PathFlavor } from '#shared/domain/path/PathContainment.ts';

/** What every use case of the manifests module is given, chosen once by the composition root. */
export interface ManifestDeps {
  /** The answers of the disk. */
  readonly ports: ManifestPorts;
  /** The path syntax of the machine, from the Environment port. */
  readonly flavor: PathFlavor;
  /** The git transports a list may name (DR-609): production gives `https` and `ssh` and reads no test variable. */
  readonly gitPolicy: GitPolicy;
}
