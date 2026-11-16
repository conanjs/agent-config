// M-11, M-01: a value that reaches a screen or a report is shown, never obeyed. A terminal or a reader treats these characters as
// commands or as a different order of the text: ESC and CSI start an escape sequence (colour, cursor moves, OSC 52 clipboard writes),
// CR and LF end or overwrite a line (a value could print its own "approve these privileged changes? (yes/no)" line), and the bidi
// controls reorder what V reads. Each one is replaced by a visible \xNN or \uNNNN, so the text still shows what was there.

// By Unicode category, so no list goes stale: Cc (C0, DEL, C1, LF, tab), Cf (format characters: the bidi controls and isolates,
// zero-width space and joiners, U+2060 word joiner, U+FEFF, U+00AD soft hyphen, the tag characters U+E0001 to U+E007F), Zl and
// Zp (U+2028, U+2029) and Default_Ignorable_Code_Point (also U+180E, the Hangul fillers U+115F, U+1160, U+3164, U+FFA0, and the
// variation selectors). Two of those are left as they are: U+FE0E and U+FE0F, the text and emoji presentation selectors, which
// an emoji in a component description needs and which cannot hide or reorder anything. U+200D (zero-width joiner, category Cf)
// is escaped, so a joined emoji sequence shows its joiners.
const UNSAFE = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}\p{Default_Ignorable_Code_Point}]/gu;
const KEPT = new Set(['\ufe0e', '\ufe0f']);

function visible(char: string): string {
  if (KEPT.has(char)) return char;
  const code = char.codePointAt(0) ?? 0;
  const hex = code.toString(16);
  if (code < 0x100) return `\\x${hex.padStart(2, '0')}`;
  return code <= 0xffff ? `\\u${hex.padStart(4, '0')}` : `\\u{${hex}}`;
}

/**
 * Replaces every control and bidi-control character of a text with a visible escape.
 *
 * LF, CR and tab are included, so one value can never print a second line. Everything else, non-ASCII letters too, is kept.
 *
 * @param text - a value that may come from a component, a git error or a file name
 * @returns the text with each unsafe character written as `\xNN` or `\uNNNN`
 */
export function escapeUnsafeText(text: string): string {
  return text.replace(UNSAFE, visible);
}
