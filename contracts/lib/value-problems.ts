// The allow-list rules for names, paths and addresses that come from a component or a list (specs/022 M-03, M-05, M-07, FR-004,
// FR-005). Each function answers with the sentence that says what is wrong, or `undefined` when the value is fine. The sentence
// never repeats the value: a value may be a password someone pasted into a URL (M-07).

/** Component, skill, agent, route and hook ids (M-03, FR-004): lowercase letters, digits and hyphens, 1 to 64 characters. */
export const ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;

const GITHUB_HOST = 'github.com';
const DRIVE_LETTER = /^[A-Za-z]:/;
// M-07, M-05: text that a URL parser silently repairs or reads differently from git (backslash as slash, a tab dropped, a line
// break that starts an option) never reaches the parser, so the string that was checked is the string git gets.
const GITHUB_PATH = /^\/[A-Za-z0-9][A-Za-z0-9-]{0,38}\/[A-Za-z0-9._-]{1,100}$/;
const SSH_USER = /^[A-Za-z0-9._-]+$/;
const PLAIN_HOST = /^[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?$/;

/**
 * Checks an id against the M-03 allow-list.
 *
 * @param value - the candidate id
 * @returns what is wrong with it, or `undefined` when it matches {@link ID_PATTERN}
 */
export function idProblem(value: string): string | undefined {
  return ID_PATTERN.test(value)
    ? undefined
    : 'must be 1 to 64 characters: lowercase letters, digits and hyphens, starting with a letter or digit';
}

/**
 * Checks a path a component supplies (a location, an index, a route's file, an export) against the M-03 rules.
 *
 * The check is on the text only; reading a file also needs the real-path check under the component root, which needs the
 * file system and so belongs to the caller (CM-3). Windows would also read a segment that ends in `.` or a space as another
 * name, and `:` as a drive or a data stream, so those are refused too.
 *
 * @param value - the candidate path
 * @returns what is wrong with it, or `undefined` when it is relative with no `..` segment, drive letter, `:`, `\` or NUL
 */
export function relativePathProblem(value: string): string | undefined {
  if (value === '') return 'must not be empty';
  if (value.includes('\0')) return 'must not contain a NUL character';
  if (value.includes('\\')) return 'must not contain a backslash; write / between folders';
  if (DRIVE_LETTER.test(value)) return 'must not start with a drive letter';
  if (value.includes(':')) return 'must not contain a colon';
  if (value.startsWith('/')) return 'must be relative, not absolute';
  const segments = value.split('/');
  if (segments.includes('..')) return 'must not contain a .. segment';
  const odd = segments.some((segment) => segment !== '.' && (segment.endsWith('.') || segment.endsWith(' ')));
  return odd ? 'must not have a folder or file name that ends in a dot or a space' : undefined;
}

/**
 * Checks a path V writes in a local file about V's own machine (a `path` source): any text without NUL.
 *
 * @param value - the candidate path
 * @returns what is wrong with it, or `undefined`
 */
export function localPathProblem(value: string): string | undefined {
  if (value === '') return 'must not be empty';
  return value.includes('\0') ? 'must not contain a NUL character' : undefined;
}

/**
 * Checks a folder a variable's `detect` probes: `~/` and then a path that passes the M-03 rules (CM-7, M-18).
 *
 * @param value - the candidate folder
 * @returns what is wrong with it, or `undefined`
 */
export function homeRelativePathProblem(value: string): string | undefined {
  if (!value.startsWith('~/')) return 'must start with ~/ and name a folder below the home folder';
  return relativePathProblem(value.slice(2));
}

// A backslash, whitespace, a control character or DEL.
function hasUnsafeCharacter(value: string): boolean {
  return Array.from(value).some((char) => {
    const code = char.codePointAt(0) ?? 0;
    return char === '\\' || /\s/.test(char) || code < 0x20 || code === 0x7f;
  });
}

// A URL the parser reads exactly as written: no repair of backslashes, case, default ports or dot segments. */
function strictUrl(value: string): URL | undefined {
  // `%` is refused everywhere: git decodes it where the parser shows it as text (`git%3apw@` is a password, `%2d` a leading -),
  // and `%3F` or `%23` would hide a query or fragment in a path. `?` and `#` are refused outright, even when empty.
  if (hasUnsafeCharacter(value) || /[%?#]/.test(value)) return undefined;
  try {
    const url = new URL(value);
    return url.href === value || url.href === `${value}/` ? url : undefined;
  } catch {
    // An unparsable text is the finding itself, so the parse error carries nothing more to report.
    return undefined;
  }
}

// `/owner/repository` with the GitHub allow-lists; the repository may end in .git but may not be only that or only dots.
function githubPathOk(pathname: string): boolean {
  const repository = pathname.split('/')[2]?.replace(/\.git$/, '') ?? '';
  return GITHUB_PATH.test(pathname) && repository !== '' && !/^\.+$/.test(repository);
}

/**
 * Checks a component's `repository` address: https, host exactly github.com, no user-info part, `/owner/repository` (A-23, M-07).
 *
 * @param value - the candidate address
 * @returns what is wrong with it, or `undefined` for a GitHub repository address
 */
export function githubUrlProblem(value: string): string | undefined {
  const expected = `must be a GitHub address such as https://${GITHUB_HOST}/<owner>/<repository>`;
  const url = strictUrl(value);
  if (url === undefined || url.protocol !== 'https:') return `${expected}, written plainly, with the scheme https`;
  if (url.username !== '' || url.password !== '') return `${expected} with no user name or password in it (M-07)`;
  if (url.hostname !== GITHUB_HOST || url.port !== '') return `${expected}: the host must be exactly ${GITHUB_HOST}`;
  if (url.search !== '' || url.hash !== '') return `${expected} with no query or fragment`;
  return githubPathOk(url.pathname) ? undefined : expected;
}

/**
 * Checks the address of a list entry's source: a URL with a scheme the entry's type allows and no secret in it (CL-3, CL-4, M-05, M-07).
 *
 * A user name alone is allowed for `ssh` (`ssh://git@host/...` is how git hosts ask for it); a password never is, and neither is
 * any user-info part on `https`. No query, no fragment, and no host that starts with `-`, which git would read as an option.
 *
 * @param value - the candidate address
 * @param schemes - the schemes allowed, without the colon, for example `['https', 'ssh']`
 * @returns what is wrong with it, or `undefined`
 */
export function sourceUrlProblem(value: string, schemes: readonly string[]): string | undefined {
  const url = strictUrl(value);
  const allowed = `must be a URL starting with ${schemes.map((scheme) => `${scheme}://`).join(' or ')}, written plainly`;
  if (url === undefined) return allowed;
  const scheme = url.protocol.replace(/:$/, '');
  if (!schemes.includes(scheme) || !PLAIN_HOST.test(url.hostname)) return allowed;
  if (url.password !== '' || (scheme !== 'ssh' && url.username !== '')) {
    return 'must not have a user name or password in it; keep credentials in git or ssh-agent (M-07)';
  }
  return scheme === 'ssh' && url.username !== '' && !SSH_USER.test(url.username)
    ? 'must have a plain user name, letters, digits, dots, hyphens or underscores (M-07)'
    : undefined;
}
