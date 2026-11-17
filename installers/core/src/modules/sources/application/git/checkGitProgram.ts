import { checkGitVersion, type GitVersionCheck } from '#sources/domain/rules/gitVersion.ts';

/**
 * Checks what `git --version` printed against the minimum the installer runs (M-05, 2.50.1). Call it once, before the first git
 * source is acquired, with the answer of the Runtime port (a fake command in the scenarios).
 *
 * @param output - the text of the version command, or `undefined` when git could not be run
 * @returns `ok`, or the version found, for `renderGitVersionError`
 */
export function checkGitProgram(output: string | undefined): GitVersionCheck {
  return checkGitVersion(output);
}
