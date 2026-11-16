import type { HomeLockStore } from '#state/application/ports/HomeLockStore.ts';
import type { StateDeps } from '#state/application/StateDeps.ts';

/** The adapters and facts the module needs: the ports of `StateDeps` plus the lock file. */
export interface StatePorts extends StateDeps {
  /** The lock file of the home. */
  readonly lock: HomeLockStore;
}
