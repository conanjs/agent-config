import type { PathProbe } from '#shared/application/containment/PathProbe.ts';
import type { PathFlavor } from '#shared/domain/path/PathContainment.ts';
import type { Clock } from '#state/application/ports/Clock.ts';
import type { FileSystem } from '#state/application/ports/FileSystem.ts';
import type { Links } from '#state/application/ports/Links.ts';

/** What every state use case needs: the ports and the folders a path may be in. */
export interface StateDeps {
  /** The file operations. */
  readonly fs: FileSystem;
  /** The link operations. */
  readonly links: Links;
  /** The real-path and identity questions of the disk. */
  readonly probe: PathProbe;
  /** The clock. */
  readonly clock: Clock;
  /** The path syntax of the machine. */
  readonly flavor: PathFlavor;
  /** The agent home, absolute; it exists, and `createHomeFolder` has checked it. */
  readonly home: string;
  /** The backups folder, `~/.agent-config-backups`, outside the home (DR-203); it may not exist yet. */
  readonly backups: string;
  /** The other folders a link may be placed in (the agent folders), absolute. */
  readonly roots: readonly string[];
}
