// The text of a git source as git would read it (M-05, M-07). The contract reader has judged the list already; these checks stand
// in front of the process call as well, because a source can also come from `add`, from a lock file or from a future caller, and
// the cost of one more look is a few comparisons while the cost of a miss is a program run with an attacker's option.
import { refuse, succeed, type Result } from '#shared/domain/result/Result.ts';

// A control character, whitespace or DEL: git reads one of them as the end of the word or as part of the next one.
// eslint-disable-next-line no-control-regex
const UNSAFE_CHARACTER = /[\s\u0000-\u001f\u007f]/;

function leadsWithDash(text: string): boolean {
  return text.startsWith('-');
}

/**
 * Refuses a source address or ref that git could read as an option, or that holds a control character or a space.
 *
 * @param url - the address from the list
 * @param ref - the branch, tag or commit from the list
 * @returns `ok`, or a sentence that says what is wrong without repeating the text
 */
export function checkGitSourceText(url: string, ref: string): Result<'ok', string> {
  if (url === '' || ref === '') return refuse('the source address and the ref must not be empty');
  if (leadsWithDash(url) || leadsWithDash(ref))
    return refuse('a source address or ref cannot start with a dash (M-05)');
  if (UNSAFE_CHARACTER.test(url) || UNSAFE_CHARACTER.test(ref)) {
    return refuse('a source address or ref cannot hold a space or a control character (M-05)');
  }
  return succeed('ok');
}

/**
 * Tells whether a source address carries a secret: a password, or a user name on a scheme that does not use one (M-07).
 * `ssh://git@host/...` is the way git hosts ask for a user and is not a secret.
 *
 * @param url - the address from the list
 * @returns true when the address must not be given to git or printed
 */
export function addressHoldsCredentials(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.password !== '' || (parsed.protocol !== 'ssh:' && parsed.username !== '');
  } catch {
    // An address that does not parse as a URL has no user-info part to read; the protocol check refuses it separately.
    return false;
  }
}
