// M-14: a retired compatibility link is kept while any hook command still names a path under it, and a privileged hook command may not
// name a compatibility path at all. The check reads text and resolves nothing on disk, and it leans to "yes, it is named":
//   - quote characters are removed, not treated as breaks, so `"$HOME"/x` and `know""ledge` read as `$HOME/x` and `knowledge`;
//   - letters are compared in lower case on every system (macOS and Windows ignore case, and a false "kept" costs nothing);
//   - a backslash is read both as a separator and as nothing (a shell escape), so `know\ledge` and `a\b` are both seen;
//   - the path is matched by its last two segments (`.copilot/patterns`), so every spelling of the home in front of it (`~`, `~user`,
//     `$HOME`, `${HOME:-x}`, `%USERPROFILE%`, an absolute home, a firmlink path such as `/System/Volumes/Data/Users/v`) is covered.
// A home that a variable the installer cannot know hides entirely (`$X/.copilot` is seen, `$(echo .co)pilot/patterns` is not) is the
// limit of a text check; `doctor` reports a hook command that does not resolve (M-14).
import path from 'node:path';

// A path-like word ends at white space or a shell operator; `=` also starts one (`--dir=~/x`). Quotes are removed before this runs.
const WORD_BREAK = /[\s;|&<>(){}[\],=]+/;
const QUOTES = /["'`]/g;

// The last two segments of a path, in lower case and with `/`, such as `.copilot/patterns`; one segment when the path has only one.
function tailOf(target: string): string {
  const segments = target
    .toLowerCase()
    .replaceAll('\\', '/')
    .split('/')
    .filter((part) => part !== '');
  return segments.slice(-2).join('/');
}

// The text in the two readings of a backslash, in lower case and without quotes, cut into words resolved with `.`, `..` and `//`.
function wordsOf(text: string): string[] {
  const lowered = text.toLowerCase().replace(QUOTES, '');
  return [lowered.replaceAll('\\', '/'), lowered.replaceAll('\\', '')].flatMap((reading) =>
    reading
      .split(WORD_BREAK)
      .filter((word) => word.length > 0)
      .map((word) => path.posix.normalize(word)),
  );
}

// The tail is found when it is followed by the end of the word or a separator, so `patterns-old` is not `patterns`.
function holdsTail(word: string, tail: string): boolean {
  for (let at = word.indexOf(tail); at !== -1; at = word.indexOf(tail, at + 1)) {
    const next = word.charAt(at + tail.length);
    if (next === '' || next === '/') return true;
  }
  return false;
}

/**
 * Tells whether a text (a command, or a whole hook file) names a path, or anything inside it.
 *
 * @param text - the text of an agent hook or settings file, or one command
 * @param target - the absolute path to look for (its last two segments are matched)
 * @returns true when some word of the text, with quotes removed and the path resolved, holds the last two segments of the target
 */
export function textNamesPath(text: string, target: string): boolean {
  const tail = tailOf(target);
  return tail !== '' && wordsOf(text).some((word) => holdsTail(word, tail));
}
