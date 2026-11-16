// M-03, the identity half of the agent-home rules. Text cannot tell that `/System/Volumes/Data/Users/v` is the folder `/Users/v` on a
// Mac (a firmlink), or that a bind mount or a case-insensitive spelling reaches the same folder; the device and index number can.
//
// FOR T132 AND T138 (every caller that creates the home): run this check twice. Once before the home exists (a missing home is
// accepted), and AGAIN right after the home folder is created and before the first write into it, because a link or mount that
// appeared in between would otherwise carry the first write into the user's home or a folder above it.
import path from 'node:path';
import type { IdentityAnswer, PathProbe } from '#shared/application/containment/PathProbe.ts';
import type { PathFlavor } from '#shared/domain/path/PathContainment.ts';
import { refuse, succeed, type Result } from '#shared/domain/result/Result.ts';

function keyOf(answer: IdentityAnswer): string | undefined {
  return answer.kind === 'identity' ? `${answer.dev}:${answer.ino}` : undefined;
}

// The user's home folder and every folder above it, nearest first, ending with the file system root.
function homeAndAncestors(userHome: string, flavor: PathFlavor): string[] {
  const flavored = path[flavor];
  const folders: string[] = [];
  for (let folder = flavored.normalize(userHome); ; folder = flavored.dirname(folder)) {
    folders.push(folder);
    if (flavored.dirname(folder) === folder) return folders;
  }
}

/**
 * Collects the identities of the user's home folder and of every folder above it.
 *
 * @param userHome - the user's absolute home folder
 * @param flavor - the path syntax
 * @param probe - the disk's answers
 * @returns the set of `dev:ino` keys, or the sentence that says why it could not be built (the home itself must exist and be readable)
 */
export function protectedIdentities(
  userHome: string,
  flavor: PathFlavor,
  probe: PathProbe,
): Result<ReadonlySet<string>, string> {
  const keys = new Set<string>();
  for (const [index, folder] of homeAndAncestors(userHome, flavor).entries()) {
    const answer = probe.identity(folder);
    const key = keyOf(answer);
    if (key !== undefined) keys.add(key);
    else if (answer.kind === 'unknown' || index === 0) {
      return refuse(
        'your home folder or a folder above it cannot be identified, so the agent home cannot be checked against it',
      );
    }
  }
  return succeed(keys);
}

/** The identity of a folder, as `PathProbe.identity` answers it when the folder exists. */
export type FolderIdentity = IdentityAnswer & { readonly kind: 'identity' };

/**
 * Refuses a candidate folder that holds a protected folder under a path text cannot relate to it: from the candidate's side, joins the
 * candidate with the last 1, 2, ... segments of the protected folder's real path and refuses when one of those joined paths has the
 * protected folder's identity.
 *
 * It catches `/System/Volumes/Data` as a holder of `/Users/v` on a Mac: the firmlink makes `/System/Volumes/Data/Users/v` the same
 * folder as `/Users/v`, while `/System/Volumes/Data` itself has the identity of no folder on the protected chain. T131 applies it to
 * the agent home too, with the protected folder of its choice.
 *
 * @param candidate - the absolute folder to test
 * @param protectedFolderRealPath - the real path of the folder that must not be held, for example the user's home
 * @param protectedIdentity - the identity of that folder
 * @param flavor - the path syntax
 * @param probe - the disk's answers
 * @returns `clear`, or the sentence that says the candidate holds the folder (a joined path whose identity cannot be read refuses too)
 */
export function checkHoldsNoProtectedFolder(
  candidate: string,
  protectedFolderRealPath: string,
  protectedIdentity: FolderIdentity,
  flavor: PathFlavor,
  probe: PathProbe,
): Result<'clear', string> {
  const flavored = path[flavor];
  const segments = flavored
    .normalize(protectedFolderRealPath)
    .split(flavored.sep)
    .filter((part) => part !== '' && !part.endsWith(':'));
  for (let count = 1; count <= segments.length; count += 1) {
    const joined = flavored.join(candidate, ...segments.slice(segments.length - count));
    const answer = probe.identity(joined);
    if (answer.kind === 'unknown')
      return refuse('a folder below it cannot be identified, so it cannot be checked against your home folder');
    if (keyOf(answer) === keyOf(protectedIdentity)) return refuse('it holds your home folder, reached by another path');
  }
  return succeed('clear');
}

/**
 * Refuses a candidate home that is the user's home folder or a folder that holds it, by file identity rather than by text.
 *
 * @param candidate - the absolute path of the agent home, as chosen
 * @param userHome - the user's absolute home folder
 * @param flavor - the path syntax
 * @param probe - the disk's answers
 * @returns `ok`, also for a candidate that does not exist yet; or the sentence that says what is wrong (an unreadable identity refuses)
 */
export function checkHomeIdentity(
  candidate: string,
  userHome: string,
  flavor: PathFlavor,
  probe: PathProbe,
): Result<'ok', string> {
  const answer = probe.identity(candidate);
  if (answer.kind === 'missing') return succeed('ok');
  if (answer.kind === 'unknown') return refuse('the folder cannot be identified, so it is not used');
  const protectedSet = protectedIdentities(userHome, flavor, probe);
  if (!protectedSet.ok) return protectedSet;
  if (protectedSet.value.has(keyOf(answer) ?? '')) {
    return refuse('it is your home folder or a folder that holds it, reached by another path');
  }
  // The candidate's own identity matches nothing on the chain when it holds the home through a firmlink (/System/Volumes/Data).
  const homeIdentity = probe.identity(userHome);
  if (homeIdentity.kind !== 'identity') return refuse('your home folder cannot be identified');
  const homeReal = probe.realPath(userHome);
  const held = checkHoldsNoProtectedFolder(
    candidate,
    homeReal.kind === 'real' ? homeReal.path : userHome,
    homeIdentity,
    flavor,
    probe,
  );
  return held.ok ? succeed('ok') : refuse(held.error);
}
