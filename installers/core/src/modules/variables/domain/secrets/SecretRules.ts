// M-08: variables are public values that every agent loads (`generated/global-variables.md`), so a name or a value that looks like a
// credential is refused instead of stored. The word and prefix lists are the ones of variables/v1 rule VR-4 and of the catalogue
// row MG-36; widening them is a change of that contract.

/** The words whose presence in a name refuses it, in the order MG-36 names them and the order a name is checked against them. */
export const SECRET_NAME_WORDS = ['TOKEN', 'SECRET', 'PASSWORD', 'APIKEY', 'API_KEY'] as const;

/** One of {@link SECRET_NAME_WORDS}. */
export type SecretNameWord = (typeof SECRET_NAME_WORDS)[number];

/** The starts of a value that refuse it: GitHub tokens, GitHub fine-grained tokens, common API keys, AWS access key ids, Slack tokens. */
export const SECRET_VALUE_PREFIXES = ['ghp_', 'github_pat_', 'sk-', 'AKIA', 'xox'] as const;

/** One of {@link SECRET_VALUE_PREFIXES}. */
export type SecretValuePrefix = (typeof SECRET_VALUE_PREFIXES)[number];

// What a reader or a loader skips at the start of a text: white space, controls and every invisible format character. A value
// that starts with a zero-width space (U+200B) and then `ghp_` is the same token to a consumer that trims, so the prefix is looked for after them (M-08).
const IGNORED_AT_START = /^[\s\p{Cc}\p{Cf}\p{Zs}\p{Zl}\p{Zp}\p{Default_Ignorable_Code_Point}]+/u;

/**
 * Finds the first secret-like word a variable name contains, compared without regard to letter case.
 *
 * @param name - the name V typed, or a name read from a file
 * @returns the word (`APIKEY` for `MY_APIKEY`, `API_KEY` for `MY_API_KEY`), or `undefined` when the name is acceptable
 */
export function secretNameWord(name: string): SecretNameWord | undefined {
  const upper = name.toUpperCase();
  return SECRET_NAME_WORDS.find((word) => upper.includes(word));
}

/**
 * Finds the secret-like prefix a value starts with, after white space, control and invisible characters are skipped.
 *
 * The prefix is compared as written, so `Skeleton` is not refused for `sk-`; a token with another letter case is not a working token.
 *
 * @param value - the value V typed, or a value read from a file
 * @returns the prefix from {@link SECRET_VALUE_PREFIXES}, never the value itself, or `undefined` when the value is acceptable
 */
export function secretValuePrefix(value: string): SecretValuePrefix | undefined {
  const visible = value.replace(IGNORED_AT_START, '');
  return SECRET_VALUE_PREFIXES.find((prefix) => visible.startsWith(prefix));
}

// Shapes of credentials that have no short fixed start, or whose start is too common to refuse alone. Every pattern is linear (no
// nested or open-ended repetition) and the value is at most 1024 characters, so none can be made slow (M-13 spirit).
const SECRET_SHAPES: readonly (readonly [name: string, pattern: RegExp])[] = [
  ['a Stripe live key (sk_live_)', /^sk_live_/],
  ['a Google API key (AIza)', /^AIza[0-9A-Za-z_-]{30,}/],
  ['an AWS temporary key id (ASIA)', /^ASIA[0-9A-Z]{12,}/],
  ['an npm token (npm_)', /^npm_[0-9A-Za-z]{20,}/],
  ['a JSON web token (eyJ...)', /eyJ[0-9A-Za-z_-]{5,}\.[0-9A-Za-z_-]{5,}\.[0-9A-Za-z_-]*/],
  ['a private key (PEM)', /-----BEGIN [A-Z ]{0,40}PRIVATE KEY-----/],
];

/**
 * Finds a credential shape in a value, after white space, control and invisible characters at its start are skipped.
 *
 * It complements {@link secretValuePrefix}: that list is the contract's (VR-4); this one adds shapes the contract does not name
 * (Stripe, Google, AWS temporary, npm, JSON web token, PEM private key), with no contract change.
 *
 * @param value - the value V typed, or a value read from a file
 * @returns a short description of the shape (never the value), or `undefined` when none matches
 */
export function secretValueShape(value: string): string | undefined {
  const visible = value.replace(IGNORED_AT_START, '');
  return SECRET_SHAPES.find(([, pattern]) => pattern.test(visible))?.[0];
}
