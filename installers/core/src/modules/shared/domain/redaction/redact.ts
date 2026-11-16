// M-07: every string the installer prints, logs or puts in a report passes through here first. The rules are text-only and
// deliberately wide: hiding a harmless word costs a little readability, printing a credential costs V a leaked secret.
//
// FOR T136 AND T208 (M-01, M-11): a privileged entry or a suggested source that `redact` would change is REFUSED, not shown with
// its secret hidden. Test it with `needsRedaction(text)` on the command, args, route text and source before building the need;
// when it is true the run fails (exit 1, "contains credential-like text", naming the component and no part of the text). V must
// never approve a line that is not the line that will run, and a redacted line is not.
//
// Cost (M-13): every rule is linear in the text. URL scanning is one pass over each whitespace-delimited word; the regular
// expressions have no nested or open-ended repetition, and a parameter or key name is capped at 128 characters.

/** What replaces a hidden secret in a printed text. */
export const REDACTED = '<redacted>';

/** What replaces a whole URL-like word whose address cannot be told from a credential. */
export const REDACTED_URL = '<redacted-url>';

const MAX_NAME_LENGTH = 128;
const MARKER_WITH_AT = `${REDACTED}@`;

// A query or fragment parameter (`?token=x`, `&access_token=x`, `#access_token=x`) whose name looks like a credential.
const PARAMETER = new RegExp(`([?&;#])([^=&;#\\s'"<>?/]{1,${MAX_NAME_LENGTH}})=([^&;#\\s'"<>]+)`, 'g');
const CREDENTIAL_NAME = /token|secret|pass|pwd|key|auth|sig|credential|session|bearer/i;

// A JSON member `"token": "x"` whose key looks like a credential. The value is a string with escapes; both parts are linear.
const JSON_MEMBER = new RegExp(`("([^"\\\\\\r\\n]{1,${MAX_NAME_LENGTH}})"\\s*:\\s*)"(?:[^"\\\\]|\\\\.)*"`, 'g');

// Token formats that are recognisable by their prefix, wherever they appear (a git error message, a log line, a header).
const PREFIXED_TOKEN = /(?<![A-Za-z0-9_])(?:gh[pousr]_[A-Za-z0-9_]+|github_pat_[A-Za-z0-9_]+|glpat-[A-Za-z0-9_-]+)/g;
const BEARER_TOKEN = /(?<![A-Za-z0-9_])(Bearer)\s+[A-Za-z0-9._~+/=-]{8,}/gi;

// `Authorization: x`, `authorization=x`, `"authorization": "x"`, `'authorization': 'x'`; quoted or not, the value is hidden.
const AUTHORIZATION = /(?<![A-Za-z0-9_])(authorization["']?\s*[:=]\s*)("[^"\r\n]*"|'[^'\r\n]*'|[^\r\n'"]+)/gi;

function decodedName(name: string): string {
  try {
    return decodeURIComponent(name);
  } catch {
    // A name that is not valid percent-encoding is matched as written; the match is the whole point, so no report is needed.
    return name;
  }
}

function hideParameter(match: string, separator: string, name: string): string {
  return CREDENTIAL_NAME.test(decodedName(name)) ? `${separator}${name}=${REDACTED}` : match;
}

function hideJsonMember(match: string, head: string, key: string): string {
  return CREDENTIAL_NAME.test(key) ? `${head}"${REDACTED}"` : match;
}

function hideAuthorization(_match: string, head: string, value: string): string {
  const quote = value.startsWith('"') || value.startsWith("'") ? value.charAt(0) : '';
  return `${head}${quote}${REDACTED}${quote}`;
}

// Where a scheme starts when `://` is at `colon`: back over scheme characters, which must begin with a letter and not follow a
// word character; -1 when the text before `://` is no scheme.
function schemeStart(word: string, colon: number): number {
  let start = colon;
  while (start > 0 && /[A-Za-z0-9+.-]/.test(word.charAt(start - 1))) start -= 1;
  while (start < colon && !/[A-Za-z]/.test(word.charAt(start))) start += 1;
  return start === colon ? -1 : start;
}

// The end of the authority: the first of `/ \\ ? # " < >` at or after `from`, or the end of the word. A quote `'` is allowed in user-info.
function authorityEnd(word: string, from: number): number {
  let end = from;
  while (end < word.length && !'/\\?#"<>'.includes(word.charAt(end))) end += 1;
  return end;
}

// The last @ in word[from, end), or -1. A backwards scan that stops at `from`, so a long word with many URLs stays linear.
function lastAtBetween(word: string, from: number, end: number): number {
  for (let index = end - 1; index >= from; index -= 1) if (word.charAt(index) === '@') return index;
  return -1;
}

// One word: hide user-info of each URL in it, and the whole URL when an @ follows the authority (a path, query or fragment holding
// an @ can pose as a different host: `https://evil.example/x@github.com/o/r`).
function redactUrls(word: string): string {
  const lastAt = word.lastIndexOf('@');
  let output = '';
  let cursor = 0;
  let colon = word.indexOf('://');
  while (colon !== -1) {
    const start = schemeStart(word, colon);
    let from = colon + 3;
    if (start !== -1 && start >= cursor) {
      if (word.startsWith(MARKER_WITH_AT, from)) from += MARKER_WITH_AT.length;
      const end = authorityEnd(word, from);
      if (lastAt >= end) return `${output}${word.slice(cursor, start)}${REDACTED_URL}`;
      const at = lastAtBetween(word, from, end);
      if (at !== -1) {
        output += `${word.slice(cursor, colon + 3)}${REDACTED}@`;
        cursor = at + 1;
      }
    }
    colon = word.indexOf('://', Math.max(from, colon + 3));
  }
  return output + word.slice(cursor);
}

/**
 * Tells whether {@link redact} would change a text, that is, whether it holds credential-like text.
 *
 * @param text - a command, an argument list, a route text or a source address
 * @returns true when the text has a credential-like part
 */
export function needsRedaction(text: string): boolean {
  return redact(text) !== text;
}

/**
 * Hides credentials in a text: user-info of a URL (and the whole URL when an `@` follows its authority), credential-named query
 * parameters and JSON keys, GitHub and GitLab token prefixes, and bearer or authorization headers.
 *
 * Running it twice gives the same text as running it once. The input is never changed and the secret is never part of any
 * error, because the function does not fail.
 *
 * @param text - any text that may reach the screen, a report or a log
 * @returns the text with each credential replaced by {@link REDACTED} (or {@link REDACTED_URL})
 */
export function redact(text: string): string {
  return text
    .replace(/\S+/g, redactUrls)
    .replace(PARAMETER, hideParameter)
    .replace(JSON_MEMBER, hideJsonMember)
    .replace(PREFIXED_TOKEN, REDACTED)
    .replace(BEARER_TOKEN, `$1 ${REDACTED}`)
    .replace(AUTHORIZATION, hideAuthorization);
}
