// DR-202 step 8: switch each journaled link in order, after the journal is written. A link already in place is skipped, so the same
// call also completes a run whose earlier attempt was restored. A real file or folder is removed only when the journal says it was
// backed up and the backup is there.
import { isSameOrInside } from '#shared/domain/path/PathContainment.ts';
import { refuse, succeed, type Result } from '#shared/domain/result/Result.ts';
import { containIn } from '#state/application/files/containIn.ts';
import type { Journal } from '#state/domain/journal/Journal.ts';
import type { UnlinkRefusal } from '#state/application/links/removeOwnLink.ts';
import { removeOwnLink } from '#state/application/links/removeOwnLink.ts';
import { placeLink, type LinkRefusal, type PlacedLink } from '#state/application/links/placeLink.ts';
import type { StateDeps } from '#state/application/StateDeps.ts';

/** One placed link of a switch. */
export interface SwitchedLink {
  /** The absolute path of the link. */
  readonly path: string;
  /** What was placed there. */
  readonly placed: PlacedLink;
}

/** Why the switch stopped; links placed before it stay as they are, and the journal can restore them. */
export interface SwitchFailure {
  /** The path of the operation that was refused. */
  readonly path: string;
  /** The refusal. */
  readonly refusal: LinkRefusal | UnlinkRefusal | { readonly kind: 'backup-missing'; readonly reason: string };
}

type BackupRefusal = SwitchFailure['refusal'];

const BACKUP_MISSING: BackupRefusal = {
  kind: 'backup-missing',
  reason: 'the backup of what is there does not exist, so it is not replaced',
};

// A real file or folder is where the link goes: it may be replaced only when the journal says it was backed up and the copy is there.
// Removes it and returns nothing, or returns why it was kept.
function clearBackedUp(deps: StateDeps, linkPath: string, backupPath: string): BackupRefusal | undefined {
  const real = containIn(deps, linkPath, 'keep-link');
  if (!real.ok) return { kind: 'outside', reason: real.error.reason };
  const backup = containIn(deps, backupPath, 'follow-link');
  if (!backup.ok) {
    // A backups folder that does not exist yet means the backup was not made; any other refusal is a path that leaves its root.
    const missing =
      isSameOrInside(deps.backups, backupPath, deps.flavor) && deps.probe.realPath(deps.backups).kind === 'missing';
    return missing ? BACKUP_MISSING : { kind: 'outside', reason: backup.error.reason };
  }
  const here = deps.fs.stat(real.value);
  if (here === undefined || here.kind === 'link') return undefined;
  if (!deps.fs.exists(backup.value)) return BACKUP_MISSING;
  deps.fs.remove(real.value);
  return undefined;
}

/**
 * Switches every link operation of the journal, in order.
 *
 * @param deps - the ports and roots
 * @param journal - the journal that was just written
 * @param targetRoots - folders outside the home that a link may point into, for `path` sources linked live (see `PlaceRequest`)
 * @param recordedLinks - links `install-state.json` records, which a later link may point at; links placed earlier in this journal count too
 * @returns what each link became (the report names a degraded one), or the first refusal; a disk failure is thrown
 */
export function switchLinks(
  deps: StateDeps,
  journal: Journal,
  targetRoots: readonly string[] = [],
  recordedLinks: readonly string[] = [],
): Result<readonly SwitchedLink[], SwitchFailure> {
  const done: SwitchedLink[] = [];
  const own = [...recordedLinks];
  for (const operation of journal.operations) {
    if (operation.op === 'unlink') {
      const removed = removeOwnLink(deps, { path: operation.path, target: operation.old.target });
      if (!removed.ok) return refuse({ path: operation.path, refusal: removed.error });
      continue;
    }
    if (operation.op !== 'link') continue;
    const kept =
      operation.old.state === 'backed-up' ? clearBackedUp(deps, operation.path, operation.old.backup) : undefined;
    if (kept !== undefined) return refuse({ path: operation.path, refusal: kept });
    const placed = placeLink(deps, {
      path: operation.path,
      target: operation.target,
      kind: operation.kind,
      targetRoots,
    });
    if (!placed.ok) return refuse({ path: operation.path, refusal: placed.error });
    own.push(operation.path);
    done.push({ path: operation.path, placed: placed.value });
  }
  return succeed(done);
}
