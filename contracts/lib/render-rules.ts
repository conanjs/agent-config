// The render rules (specs/022 T057, DR-106, DR-304, rendered-copy-v1.md RC-1 to RC-5, A-20 to A-22, A-28): the one place where
// "{{AGENT_HOME}}" paths become real paths, the generated-from line is defined and characters are counted. The dry-run baseline
// (T075) applies these functions in memory; the renderer (phase 5) applies the same functions to files, so the size measured in
// phase 0 and the text loaded in phase 5 are comparable. Everything here is a pure function of its arguments: the platform and
// the home folder are passed in, so the Windows rules run on every operating system.
/** The systems the rules know. Only the path separator differs between them. */
export type Platform = 'darwin' | 'linux' | 'win32';

/** What the swap needs to know about the machine and the file. */
export interface SwapContext {
  /** The real agent home as the system writes it, for example `/Users/v/.agent-config` or `C:\Users\v\.agent-config`. */
  readonly home: string;
  /** Decides the separator used inside the swapped path. */
  readonly platform: Platform;
  /** Whole lines that keep their text as written (A-21); each is compared with a source line without its line ending. */
  readonly allowList: readonly string[];
}

// The generated-from line of AC-16.4 and rendered-copy-v1.md, split at the path so a second render can find it (RC-4).
const GENERATED_FROM_START = 'Generated from `';
const GENERATED_FROM_END = '`; edit that file, not this copy.';
const GENERATED_FROM_LINE = /^Generated from `[^`\r\n]+`; edit that file, not this copy\.$/;
const FRONT_MATTER_FENCE = '---';
const BYTE_ORDER_MARK = '\uFEFF';

// A path continues until a character that ends a path in prose or Markdown: whitespace, a closing bracket or quote, a backtick.
const PATH_TAIL = String.raw`(?:\/[^\s` + '`' + String.raw`'")\]>|<]*)?`;
// A path right after `](` or `]: ` is a link target, which is relative in a rendered copy (A-20) and is set by the renderer
// with relativeTarget; the swap leaves it alone, so a target never becomes an absolute path.
const NOT_A_TARGET = String.raw`(?<!\]\()(?<!\]:\s)`;
const PLACEHOLDER = new RegExp(String.raw`${NOT_A_TARGET}\{\{AGENT_HOME\}\}(${PATH_TAIL})`, 'g');
// `~/.copilot` is the old agent home (core.instructions.md); it must end there, so `~/.copilot-x` is a different folder.
const TILDE_COPILOT = new RegExp(String.raw`${NOT_A_TARGET}~\/\.copilot(?![A-Za-z0-9_-])(${PATH_TAIL})`, 'g');

function realHome(context: SwapContext): string {
  const home = context.home.replace(/[\\/]+$/, '');
  if (home === '')
    throw new RangeError('the agent home must not be empty: swapping would write paths at the root folder');
  return home;
}

// The home followed by the rest of the path, written with the platform's separator.
function swapped(home: string, rest: string, platform: Platform): string {
  return platform === 'win32' ? home + rest.replaceAll('/', '\\') : home + rest;
}

function swapLine(line: string, home: string, platform: Platform): string {
  const replace = (_whole: string, rest: string): string => swapped(home, rest, platform);
  return line.replace(PLACEHOLDER, replace).replace(TILDE_COPILOT, replace);
}

/**
 * Replaces every agent-home path in a text by the real path on this machine.
 *
 * Both `{{AGENT_HOME}}/<path>` and the old `~/.copilot/<path>` are swapped, in link text, prose, code spans and code blocks alike,
 * because a rendered file holds no placeholder path apart from the allow-list (RC-5). The path keeps its `/` separators on Mac
 * and Linux and takes `\` on Windows. A link target (the part after `](` or `]: `) is not touched: it is relative in a rendered
 * copy and the renderer sets it with {@link relativeTarget}, so the swap never makes a target absolute (A-20). Lines and their endings are otherwise kept byte for byte.
 *
 * @param text - the source text
 * @param context - the home, the platform and the allow-list
 * @returns the text with the paths swapped; a text with no agent-home path is returned equal to the input
 * @throws RangeError when the home is empty, which would turn every path into a path at the root folder
 */
export function swapAgentHome(text: string, context: SwapContext): string {
  const home = realHome(context);
  const kept = new Set(context.allowList.filter((line) => line !== ''));
  return text
    .split(/(?<=\n)/)
    .map((lineWithEnding) => {
      const line = lineWithEnding.replace(/\r?\n$/, '');
      return kept.has(line) ? lineWithEnding : swapLine(lineWithEnding, home, context.platform);
    })
    .join('');
}

/**
 * Writes the line that tells a reader where a rendered file comes from (AC-16.4, RC-6).
 *
 * @param sourcePath - the path of the source file inside its repository, with `/` separators
 * @returns the line without a line ending; a backtick or a line break in the path is percent-encoded so the line stays one code span
 */
export function generatedFromLine(sourcePath: string): string {
  const safe = sourcePath.replaceAll('`', '%60').replaceAll('\r', '%0D').replaceAll('\n', '%0A');
  return `${GENERATED_FROM_START}${safe}${GENERATED_FROM_END}`;
}

function endingOfFirstLine(text: string): string {
  return /^[^\n]*\r\n/.test(text) ? '\r\n' : '\n';
}

// Where the generated-from line goes (A-22): after the closing fence of leading front matter, else first. A byte order mark
// before the opening fence belongs to the file and stays first. `joined` is true when the front matter ends the text with no line ending.
function lineStart(text: string): { readonly at: number; readonly joined: boolean } {
  const bom = text.startsWith(BYTE_ORDER_MARK) ? BYTE_ORDER_MARK.length : 0;
  const lines = text.slice(bom).split(/(?<=\n)/);
  if (lines[0]?.replace(/\r?\n$/, '') !== FRONT_MATTER_FENCE) return { at: bom, joined: false };
  let at = bom + lines[0].length;
  for (const line of lines.slice(1)) {
    at += line.length;
    if (line.replace(/\r?\n$/, '') === FRONT_MATTER_FENCE) return { at, joined: !line.endsWith('\n') };
  }
  return { at: bom, joined: false };
}

/**
 * Puts the generated-from line first, or right after the closing `---` of the front matter when the text starts with one (A-22).
 *
 * A text that already has the line at that place is returned unchanged, so rendering a rendered text adds nothing (RC-4); a first
 * line that merely starts with the same words is not the line.
 *
 * @param text - the text, with or without front matter or a leading byte order mark
 * @param sourcePath - the path of the source file, as for {@link generatedFromLine}
 * @returns the text with exactly one generated-from line at its place; the line takes the line ending of the first line
 */
export function addGeneratedFromLine(text: string, sourcePath: string): string {
  const { at, joined } = lineStart(text);
  const next = text.slice(at).split('\n', 1)[0]?.replace(/\r$/, '') ?? '';
  if (GENERATED_FROM_LINE.test(next)) return text;
  const ending = endingOfFirstLine(text);
  return `${text.slice(0, at)}${joined ? ending : ''}${generatedFromLine(sourcePath)}${ending}${text.slice(at)}`;
}

/**
 * Renders one source text as an agent would load it: the agent-home paths swapped, then the generated-from line added.
 *
 * @param text - the source text
 * @param context - the home, the platform and the allow-list
 * @param sourcePath - the path of the source file, for the generated-from line
 * @returns the rendered text; rendering its own output gives the same text
 */
export function renderText(text: string, context: SwapContext, sourcePath: string): string {
  // The swap comes first so the generated-from line, which is not source text, can never be swapped or matched by the allow-list.
  return addGeneratedFromLine(swapAgentHome(text, context), sourcePath);
}

/**
 * Counts characters the way the baseline records them: Unicode code points (DR-106, A-7).
 *
 * A letter with an accent written as one code point counts 1 and written as two (letter plus combining mark) counts 2; a character
 * outside the Basic Multilingual Plane, such as an emoji, counts 1 although JavaScript's `length` says 2; a Windows line ending
 * counts 2.
 *
 * @param text - the text to count
 * @returns the number of code points in the text
 */
export function countCharacters(text: string): number {
  return Array.from(text).length;
}

/**
 * Gives the relative target of a citation inside a rendered copy: the way from the copy's own folder to the cited file (A-20).
 *
 * @param copyFile - the copy, as a path below the home with `/` separators, for example `generated/agentic-sdlc/foo.md`
 * @param citedPath - the cited file or folder, below the home as well, for example `knowledge/x.md`
 * @returns a path with `/` separators on every system, `.` for the copy's own folder, and `%`, space, `#`, `(` and `)` percent-encoded
 */
export function relativeTarget(copyFile: string, citedPath: string): string {
  const fromFolder = copyFile.split('/').slice(0, -1);
  const to = citedPath.split('/');
  const shared = fromFolder.findIndex((segment, index) => segment !== to[index]);
  const common = shared === -1 ? fromFolder.length : shared;
  const steps = [...fromFolder.slice(common).map(() => '..'), ...to.slice(common)];
  const path = steps.length === 0 ? '.' : steps.join('/');
  // `%` first, so the percent signs the later replacements add are not encoded again.
  return path
    .replaceAll('%', '%25')
    .replaceAll(' ', '%20')
    .replaceAll('#', '%23')
    .replaceAll('(', '%28')
    .replaceAll(')', '%29');
}
