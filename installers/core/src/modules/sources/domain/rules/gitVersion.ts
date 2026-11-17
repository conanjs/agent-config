// The git program must be new enough (M-05, DR-105, C-5): 2.50.1 is the floor of the security review. The check reads what
// `git --version` printed and compares numbers; it is the pattern of the node check of AC-5.9.

/** The oldest git the installer runs for a git source. */
export const MINIMUM_GIT = '2.50.1';

const MINIMUM: readonly [number, number, number] = [2, 50, 1];
const FOUND = /(\d+)\.(\d+)\.(\d+)/;

/** What the version check found. */
export type GitVersionCheck =
  | { readonly ok: true }
  | {
      readonly ok: false;
      /** The version git reported, such as `2.40.0`, or `not found` when git printed nothing readable. */
      readonly found: string;
    };

/**
 * Checks the output of `git --version` against the minimum.
 *
 * @param output - what the Runtime port got from the git version command, or `undefined` when git could not be run
 * @returns `ok`, or the version found so the message can print it
 */
export function checkGitVersion(output: string | undefined): GitVersionCheck {
  const match = output === undefined ? null : FOUND.exec(output);
  if (match === null) return { ok: false, found: 'not found' };
  const found = [Number(match[1]), Number(match[2]), Number(match[3])] as const;
  const order = found.reduce((result, part, index) => (result !== 0 ? result : part - (MINIMUM[index] ?? 0)), 0);
  return order >= 0 ? { ok: true } : { ok: false, found: found.join('.') };
}
