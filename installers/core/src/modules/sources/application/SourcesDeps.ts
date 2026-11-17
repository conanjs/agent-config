import type { GitPolicy } from '#manifests/application/ManifestTypes.ts';
import type { GitPort } from '#sources/application/ports/GitPort.ts';
import type { SourceDisk } from '#sources/application/ports/SourceDisk.ts';
import type { PathFlavor } from '#shared/domain/path/PathContainment.ts';

/** What every use case of the sources module is given, chosen once by the composition root. */
export interface SourcesDeps {
  /** The git program. */
  readonly git: GitPort;
  /** The disk questions. */
  readonly disk: SourceDisk;
  /** The transports a git source may use (DR-609): production gives `https` and `ssh` and reads no test variable. */
  readonly gitPolicy: GitPolicy;
  /** The path syntax of the machine. */
  readonly flavor: PathFlavor;
}
