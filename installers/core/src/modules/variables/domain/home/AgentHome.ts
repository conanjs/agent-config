// FR-013, AC-2.1 to AC-2.5, M-03 (the PathContainment.ts header asks for this): which folder is the agent home, and which folders are
// never acceptable as one. Every uninstall, backup and containment rule treats the home as a folder the installer owns, so a home that
// is a file system root, the user's own home folder or a folder that holds it would let one run touch the user's whole account.
// Text-only and pure: the Environment port gives `configuredHome`, `userHome` and `flavor`; the real path on disk is checked after
// this by `verifyHomeOnDisk`.
import path from 'node:path';
import { escapeUnsafeText } from '#shared/domain/redaction/escapeUnsafeText.ts';
import { isSameOrInside, type PathFlavor } from '#shared/domain/path/PathContainment.ts';
import { refuse, succeed, type Result } from '#shared/domain/result/Result.ts';

/** Where the chosen home came from, as MG-01 prints it: `default`, `AGENT_CONFIG_HOME` or `recorded`. */
export type AgentHomeSource = 'default' | 'AGENT_CONFIG_HOME' | 'recorded';

/** The agent home of this run. */
export interface AgentHomeChoice {
  /** The normalized absolute path: no `..`, no trailing separator. */
  readonly path: string;
  /** Where the path came from. */
  readonly source: AgentHomeSource;
  /** True only for the recorded home, which V confirmed in an earlier run (AC-2.4). */
  readonly confirmed: boolean;
  /** Set only for a move (AC-2.5): the confirmed home that `path` would replace. */
  readonly recordedHome: string | undefined;
}

/** Why no home can be chosen; each sentence says what is wrong and never repeats the text it refused. */
export interface AgentHomeViolation {
  /** Which input was refused: the environment variable, the recorded home, the default home, or the user's home folder itself. */
  readonly input: 'AGENT_CONFIG_HOME' | 'recorded-home' | 'default-home' | 'user-home';
  /** The sentence that says what is wrong. */
  readonly reason: string;
}

/** What the choice needs from the machine. */
export interface AgentHomeRequest {
  /** The path syntax of the machine: `win32` or `posix`. */
  readonly flavor: PathFlavor;
  /** The user's home folder: `HOME` on Mac and Linux, `USERPROFILE` on Windows (never `APPDATA`, AC-2.2). Absolute. */
  readonly userHome: string;
  /** The value of `AGENT_CONFIG_HOME` as the process sees it; `undefined` and the empty text both mean "not set". */
  readonly configuredHome: string | undefined;
  /** The home recorded as confirmed in `install-state.json`, if there is one. */
  readonly recordedHome: string | undefined;
}

/** The folder that is the home when nothing else is chosen: `.agent-config` in the user's home. */
export const DEFAULT_HOME_FOLDER = '.agent-config';

// A space separator other than the ASCII space (no-break space, ideographic space, ...) can make two folders look alike in a screen.
const NON_ASCII_SPACE = /[\p{Zs}]/u;

function isUnsafeText(text: string): boolean {
  const oddSpace = [...text].some((char) => char !== ' ' && NON_ASCII_SPACE.test(char));
  return text.includes('\0') || escapeUnsafeText(text) !== text || !text.isWellFormed() || oddSpace;
}

// The same folder in the spelling the comparison uses: a Windows path ignores case, and so does a Mac volume by default, so
// every flavor is compared in lower case. Refusing `/users/v` when the user home is `/Users/v` is the safe direction.
function folded(text: string): string {
  return text.toLowerCase();
}

// Removes the separator at the end that `normalize` keeps (`/a/b/` and `C:\a\`); the caller has already refused a root.
function withoutTrailingSeparator(normalized: string, flavor: PathFlavor): string {
  const flavored = path[flavor];
  const rootLength = flavored.parse(normalized).root.length;
  let end = normalized.length;
  while (end > rootLength && normalized.charAt(end - 1) === flavored.sep) end -= 1;
  return normalized.slice(0, end);
}

// A Windows path with no drive letter and no share (`\x`, `/x`) is absolute for `path.win32` but names a folder of the current drive.
const WINDOWS_ANCHORED = /^([A-Za-z]:[\\/]|[\\/]{2}[^\\/])/;

/**
 * Checks one candidate home folder by its text: absolute, free of control characters, not a file system root, not the user's home
 * folder and not a folder that holds it.
 *
 * @param candidate - the folder, as configured or as recorded
 * @param userHome - the user's absolute home folder
 * @param flavor - the path syntax of both
 * @returns the normalized path (`..` resolved, no trailing separator), or the sentence that says what is wrong
 */
export function checkHomeFolder(candidate: string, userHome: string, flavor: PathFlavor): Result<string, string> {
  const flavored = path[flavor];
  if (isUnsafeText(candidate)) return refuse('it contains a control, line-break or invisible character');
  if (!flavored.isAbsolute(candidate) || (flavor === 'win32' && !WINDOWS_ANCHORED.test(candidate))) {
    return refuse('it must be an absolute path (no ~, no relative folder, and on Windows a drive or share)');
  }
  const normalized = flavored.normalize(candidate);
  if (flavored.parse(normalized).root === normalized)
    return refuse('it must not be a file system root or a drive root');
  const folder = withoutTrailingSeparator(normalized, flavor);
  if (isSameOrInside(folded(folder), folded(flavored.normalize(userHome)), flavor)) {
    return refuse('it must not be your home folder or a folder that holds it');
  }
  return succeed(folder);
}

function choose(
  source: AgentHomeSource,
  homePath: string,
  confirmed: boolean,
  recordedHome: string | undefined,
): AgentHomeChoice {
  return { path: homePath, source, confirmed, recordedHome };
}

function sameFolder(left: string, right: string, flavor: PathFlavor): boolean {
  return flavor === 'win32' ? left.toLowerCase() === right.toLowerCase() : left === right;
}

// The folders the request names, each checked; an input that is not set is `undefined`.
interface CheckedInputs {
  readonly recorded: string | undefined;
  readonly configured: string | undefined;
}

// A folder that may be unset: `undefined` and the empty text are "not set"; any other text must pass the folder rules.
function checkOptionalHome(
  text: string | undefined,
  userHome: string,
  flavor: PathFlavor,
): Result<string | undefined, string> {
  if (text === undefined || text === '') return succeed(undefined);
  return checkHomeFolder(text, userHome, flavor);
}

function checkInputs(request: AgentHomeRequest): Result<CheckedInputs, AgentHomeViolation> {
  const { flavor, userHome } = request;
  if (!path[flavor].isAbsolute(userHome) || isUnsafeText(userHome)) {
    return refuse({
      input: 'user-home',
      reason: 'the user home folder is not an absolute path, so the default home cannot be placed',
    });
  }
  const recorded = checkOptionalHome(request.recordedHome, userHome, flavor);
  if (!recorded.ok) {
    return refuse({
      input: 'recorded-home',
      reason: `the home recorded in install-state.json is not usable: ${recorded.error}`,
    });
  }
  const configured = checkOptionalHome(request.configuredHome, userHome, flavor);
  if (!configured.ok) {
    return refuse({ input: 'AGENT_CONFIG_HOME', reason: `AGENT_CONFIG_HOME is not usable: ${configured.error}` });
  }
  return succeed({ recorded: recorded.value, configured: configured.value });
}

// With a recorded home: it, or a move to the configured one.
function chooseWithRecorded(recorded: string, configured: string | undefined, flavor: PathFlavor): AgentHomeChoice {
  if (configured === undefined || sameFolder(configured, recorded, flavor))
    return choose('recorded', recorded, true, undefined);
  return choose('AGENT_CONFIG_HOME', configured, false, recorded);
}

/**
 * Chooses the agent home of this run, with where it came from and whether V already confirmed it.
 *
 * With nothing recorded: `AGENT_CONFIG_HOME` when it is set (an empty text is "not set"), else `.agent-config` in the user's home;
 * not confirmed. With a recorded home: it, confirmed, unless `AGENT_CONFIG_HOME` names another folder, which is a move: the new
 * folder, not confirmed, with the recorded one named (AC-2.5). The same folder in `AGENT_CONFIG_HOME` counts as the recorded home.
 * A recorded home that fails the folder rules is refused too (a hand-edited state file).
 *
 * @param request - the facts the Environment port and the recorded state give
 * @returns the choice, or which input was refused and why (the caller exits 1 naming the input, never the text)
 */
export function chooseAgentHome(request: AgentHomeRequest): Result<AgentHomeChoice, AgentHomeViolation> {
  const inputs = checkInputs(request);
  if (!inputs.ok) return inputs;
  const { recorded, configured } = inputs.value;
  if (recorded !== undefined) return succeed(chooseWithRecorded(recorded, configured, request.flavor));
  if (configured !== undefined) return succeed(choose('AGENT_CONFIG_HOME', configured, false, undefined));
  const flavored = path[request.flavor];
  return succeed(
    choose('default', flavored.join(flavored.normalize(request.userHome), DEFAULT_HOME_FOLDER), false, undefined),
  );
}
