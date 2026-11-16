// How a state file is written and read (DR-202, DR-104, LK-4): a temporary file created exclusively beside the target, then a rename
// onto it, so a reader sees the old file or the new one and a kill leaves one of them. The rename is the commit of the file. The
// temporary name ends in `.tmp`, so a fault or kill rule that looks at the name of a final file (`install-state.json`) fires at the
// rename, which is the commit point of a run (the fault `kill-at:before-commit`).
import { refuse, succeed, type Result } from '#shared/domain/result/Result.ts';
import { containIn, type ContainViolation } from '#state/application/files/containIn.ts';
import type { StateDeps } from '#state/application/StateDeps.ts';

/** Why a state file was not written or read. */
export type FileRefusal =
  { readonly kind: 'outside'; readonly reason: string } | { readonly kind: 'is-link' | 'not-a-file' };

function outside(violation: ContainViolation): FileRefusal {
  return { kind: 'outside', reason: violation.reason };
}

/**
 * Writes a file by a temporary file and a rename, owner-only (0600).
 *
 * A temporary file left by a killed run is removed first: the home lock guarantees that no other run owns it. A link or a folder at
 * the target is refused, never replaced.
 *
 * @param deps - the ports and roots
 * @param target - the absolute path of the file
 * @param text - the content
 * @returns `written`, or why the path was refused; a failure of the disk is thrown (the caller reports it with MG-38)
 */
export function writeFileAtomically(deps: StateDeps, target: string, text: string): Result<'written', FileRefusal> {
  const final = containIn(deps, target, 'keep-link');
  if (!final.ok) return refuse(outside(final.error));
  const temporary = containIn(deps, `${target}.tmp`, 'keep-link');
  if (!temporary.ok) return refuse(outside(temporary.error));
  const existing = deps.fs.stat(final.value);
  if (existing !== undefined && existing.kind !== 'file')
    return refuse({ kind: existing.kind === 'link' ? 'is-link' : 'not-a-file' });
  if (deps.fs.exists(temporary.value)) deps.fs.remove(temporary.value);
  deps.fs.writeFile(temporary.value, text);
  deps.fs.rename(temporary.value, final.value);
  return succeed('written');
}

/** What reading a state file gave. */
export type FileRead = { readonly kind: 'absent' } | { readonly kind: 'text'; readonly text: string };

/**
 * Reads a regular file under the home; a link or a folder at the path is refused.
 *
 * @param deps - the ports and roots
 * @param target - the absolute path of the file
 * @returns the text, `absent`, or why the path was refused
 */
export function readFileIfPresent(deps: StateDeps, target: string): Result<FileRead, FileRefusal> {
  const checked = containIn(deps, target, 'keep-link');
  if (!checked.ok) return refuse(outside(checked.error));
  const found = deps.fs.stat(checked.value);
  if (found === undefined) return succeed({ kind: 'absent' });
  if (found.kind !== 'file') return refuse({ kind: found.kind === 'link' ? 'is-link' : 'not-a-file' });
  return succeed({ kind: 'text', text: deps.fs.readFile(checked.value) });
}
