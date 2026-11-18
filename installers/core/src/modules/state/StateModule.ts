// The composer of the state module (MOD-11): it receives the adapters from the composition root (T142) and returns the use cases with
// their ports filled in. It imports no adapter itself.
import { sha256Hex } from '#shared/domain/hash/sha256Hex.ts';
import { emitComponentsLock } from '#state/domain/components/ComponentsLock.ts';
import { backupItems } from '#state/application/backup/backupItems.ts';
import { readNewestBackup } from '#state/application/backup/readNewestBackup.ts';
import { commitRun } from '#state/application/commit/commitRun.ts';
import { writeFileAtomically } from '#state/application/files/atomicFiles.ts';
import { readComponentsLock, readInstallState, writeJournal } from '#state/application/files/stateFiles.ts';
import { createHomeFolder } from '#state/application/home/createHomeFolder.ts';
import { restoreFromJournal } from '#state/application/journal/restoreJournal.ts';
import { switchLinks } from '#state/application/journal/switchLinks.ts';
import { removeOwnLink } from '#state/application/links/removeOwnLink.ts';
import { ensureFolderIn } from '#state/application/home/ensureFolderIn.ts';
import { placeLink } from '#state/application/links/placeLink.ts';
import { appendInstallLog } from '#state/application/log/appendInstallLog.ts';
import { acquireHomeLock, holdsHomeLock, refreshHomeLock, releaseHomeLock } from '#state/application/lock/homeLock.ts';
import type { StateApi } from '#state/application/StateApi.ts';
import type { StatePorts } from '#state/application/StatePorts.ts';
import { removeManagedFolder, stageStoreTree } from '#state/application/store/managedTrees.ts';
import { pruneStoreTrees } from '#state/application/store/pruneStoreTrees.ts';

/**
 * Builds the state use cases over the given adapters.
 *
 * @param ports - the adapters, chosen by the composition root
 * @returns the use cases, ready to call
 */
export function composeState(ports: StatePorts): StateApi {
  return {
    createHome: (userHome) => createHomeFolder(ports, userHome),
    acquireLock: (request) => acquireHomeLock({ lock: ports.lock, clock: ports.clock }, request),
    releaseLock: (handle) => releaseHomeLock({ lock: ports.lock, clock: ports.clock }, handle),
    holdsLock: (handle) => holdsHomeLock({ lock: ports.lock, clock: ports.clock }, handle),
    refreshLock: (handle) => refreshHomeLock({ lock: ports.lock, clock: ports.clock }, handle),
    readComponentsLock: () => readComponentsLock(ports),
    readInstallState: () => readInstallState(ports),
    writeJournal: (journal) => writeJournal(ports, journal),
    writeFile: (target, text) => writeFileAtomically(ports, target, text),
    placeLink: (request) => placeLink(ports, request),
    removeLink: (request) => removeOwnLink(ports, request),
    ensureFolder: (folder) => ensureFolderIn(ports, folder),
    switchLinks: (journal, targetRoots, recordedLinks) => switchLinks(ports, journal, targetRoots, recordedLinks),
    restoreFromJournal: () => restoreFromJournal(ports),
    commit: (lock, state) => commitRun(ports, lock, state),
    lockHash: (lock) => sha256Hex(emitComponentsLock(lock)),
    backup: (originals) => backupItems(ports, originals),
    readNewestBackup: () => readNewestBackup(ports),
    appendLog: (entry) => appendInstallLog(ports, entry),
    stageTree: (request) => stageStoreTree(ports, request),
    removeManagedFolder: (folder) => removeManagedFolder(ports, folder),
    pruneStore: (currentIds) => pruneStoreTrees(ports, currentIds),
  };
}
