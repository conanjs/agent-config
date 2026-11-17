// The printed texts of the sources module, all rows of the shared message catalogue (TR-5). `renderMessage` hides credentials and
// shows control characters in every value, so a hostile name, address or git error cannot print a secret or a second line (M-07, M-11).
import { renderMessage } from '#shared/domain/messages/renderMessage.ts';
import type {
  GitAcquired,
  GitFetchFailed,
  GitRefused,
  GitTagMoved,
  PathAcquired,
} from '#sources/domain/model/Acquisition.ts';
import { MINIMUM_GIT } from '#sources/domain/rules/gitVersion.ts';

const short = (commit: string): string => commit.slice(0, 12);

/**
 * Writes the line for a git component that is in place (MG-14): `component kb: git https://... main at 0123456789ab`.
 *
 * @param acquired - the acquired git source
 * @returns the line, without a line break
 */
export function renderGitComponent(acquired: GitAcquired): string {
  return renderMessage('MG-14.git', {
    name: acquired.name,
    url: acquired.url,
    ref: acquired.ref,
    commit: short(acquired.commit),
  });
}

/**
 * Writes the line for a `path` component that is linked live (MG-14).
 *
 * @param acquired - the acquired path source
 * @returns the line, without a line break
 */
export function renderPathComponent(acquired: PathAcquired): string {
  return renderMessage('MG-14.path', { name: acquired.name, path: acquired.path });
}

/**
 * Writes the commit range of an advanced git source (MG-15), or nothing when the commit did not change.
 *
 * @param acquired - the acquired git source
 * @returns `updated kb: <old12>..<new12>`, or `undefined` when the source stayed on its commit
 */
export function renderUpdated(acquired: GitAcquired): string | undefined {
  return acquired.advancedFrom === undefined
    ? undefined
    : renderMessage('MG-15', { name: acquired.name, from: short(acquired.advancedFrom), to: short(acquired.commit) });
}

/**
 * Writes the warning for a component whose repository has submodules (MG-22, M-05).
 *
 * @param acquired - the acquired git source
 * @returns the line, or `undefined` when the clone has no `.gitmodules`
 */
export function renderSubmodulesWarning(acquired: GitAcquired): string | undefined {
  return acquired.submodules ? renderMessage('MG-22', { name: acquired.name }) : undefined;
}

/**
 * Writes the error for a git source that could not be fetched (MG-32) and the indented line with what git said, which is the only
 * place git's standard error is printed.
 *
 * @param failure - the failed fetch
 * @returns two lines, without line breaks
 */
export function renderFetchFailure(failure: GitFetchFailed): readonly string[] {
  return [
    renderMessage('MG-32', { name: failure.name, url: failure.url, ref: failure.ref }),
    renderMessage('MG-32.cause', { cause: failure.cause }),
  ];
}

/**
 * Writes the error for a pinned tag that names another commit now (MG-29, M-02).
 *
 * @param moved - the tag-moved answer
 * @returns the line, without a line break
 */
export function renderTagMoved(moved: GitTagMoved): string {
  return renderMessage('MG-29', { name: moved.name, tag: moved.tag, locked: moved.locked, current: moved.current });
}

/**
 * Writes the error for a git source that was refused before git ran (MG-46).
 *
 * @param refused - the refusal
 * @returns the line, without a line break
 */
export function renderGitRefused(refused: GitRefused): string {
  return renderMessage('MG-46', { name: refused.name, reason: refused.reason });
}

/**
 * Writes the error for a git program that is older than the minimum (MG-44, M-05).
 *
 * @param name - the component that needs git
 * @param found - the version found, or `not found`
 * @returns the line, without a line break
 */
export function renderGitVersionError(name: string, found: string): string {
  return renderMessage('MG-44', { name, tool: 'git', range: `>=${MINIMUM_GIT}`, version: found });
}
