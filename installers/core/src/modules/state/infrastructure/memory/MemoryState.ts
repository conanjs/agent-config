// The state module over an in-memory disk with a fixed clock: the composition a dry run uses (DR-306) and the one the unit tests share.
import path from 'node:path';
import type { PathFlavor } from '#shared/domain/path/PathContainment.ts';
import type { Clock } from '#state/application/ports/Clock.ts';
import type { StatePorts } from '#state/application/StatePorts.ts';
import { createMemoryDisk, type MemoryDisk } from '#state/infrastructure/memory/MemoryDisk.ts';

/** A clock that stands still until it is set, and records the pauses a waiting run asked for. */
export interface FixedClock extends Clock {
  /** Moves the clock to an ISO instant. */
  set(instant: string): void;
  /** The pauses asked for, in milliseconds. */
  readonly sleeps: number[];
}

/**
 * Makes a clock that stands still, so a scenario or test controls the age of a lock.
 *
 * @param instant - the ISO instant it starts at
 * @returns a clock whose `now` stays at that instant until `set` moves it
 */
export function createFixedClock(instant: string): FixedClock {
  let current = new Date(instant);
  const sleeps: number[] = [];
  return {
    now: () => new Date(current),
    sleep(milliseconds) {
      sleeps.push(milliseconds);
      return Promise.resolve();
    },
    set(next) {
      current = new Date(next);
    },
    sleeps,
  };
}

/** An in-memory home with its disk and clock. */
export interface MemoryState {
  /** The disk, for setting a scene and reading the result. */
  readonly disk: MemoryDisk;
  /** The clock. */
  readonly clock: FixedClock;
  /** The ports and folders, ready for `composeState` or any state use case. */
  readonly ports: StatePorts;
  /** The user's home folder of this machine. */
  readonly userHome: string;
}

/**
 * Builds an empty machine: the user's home with the agent home, the backups folder and three agent folders under it.
 *
 * @param flavor - which path syntax the paths of the machine use: `posix` gives `/h/...`, `win32` gives `C:\h\...`
 * @returns the disk, clock and ports
 */
export function createMemoryState(flavor: PathFlavor = 'posix'): MemoryState {
  const flavored = path[flavor];
  const userHome = flavor === 'posix' ? '/h' : 'C:\\h';
  const disk = createMemoryDisk(flavor);
  const home = flavored.join(userHome, '.agent-config');
  const backups = flavored.join(userHome, '.agent-config-backups');
  const roots = ['.claude', '.copilot', '.codex'].map((folder) => flavored.join(userHome, folder));
  for (const folder of [home, ...roots]) disk.seedFolder(folder);
  const clock = createFixedClock('2026-11-20T09:14:03.000Z');
  return {
    disk,
    clock,
    userHome,
    ports: {
      fs: disk.fs,
      links: disk.links,
      probe: disk.probe,
      clock,
      flavor,
      home,
      backups,
      roots,
      lock: disk.lockStoreAt(flavored.join(home, 'install.lock')),
    },
  };
}
