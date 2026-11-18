// The questions the commands ask the machine and the person at the keyboard, owned here and answered by adapters that
// src/CompositionRoot.ts chooses (DR-305, DR-609). Production gives the process environment, the real terminal and the real programs;
// a test composition gives a fixed environment and a scripted terminal. Nothing here is read from an environment variable by the commands.
import type { PathFlavor } from '#shared/domain/path/PathContainment.ts';
import type { WiringObservation } from '#wiring/application/WiringTypes.ts';

/** The facts about the machine and the run that the commands need and cannot compute (the Environment port of DR-305). */
export interface Environment {
  /** The path syntax of the machine: `win32` or `posix`. */
  readonly flavor: PathFlavor;
  /** The user's home folder: the home variable on Mac and Linux, the profile variable on Windows (never the application-data folder, AC-2.2). */
  readonly userHome: string;
  /** The value of `AGENT_CONFIG_HOME`; `undefined` and the empty text both mean "not set". */
  readonly configuredHome: string | undefined;
  /** The folder of the agent-config checkout: its core `component.yaml`, `components.yaml`, `compat.yaml` and `contracts/slots.yaml`. */
  readonly repoRoot: string;
  /** The process id, written into the lock file for the person who has to read it (the pid is informative only, M-12). */
  readonly processId: number;
  /** The installer that runs: its version and the commit of its checkout, recorded in `install-state.json`. */
  readonly installer: { readonly version: string; readonly commit: string };
}

/**
 * The terminal of the run (the Terminal port of DR-305). Consent is asked only when `interactive` is true: standard input and output are
 * a terminal, never a pipe, a file or an environment variable (M-11, AC-4.7).
 */
export interface Terminal {
  /** True only when a person can answer: both standard input and standard output are a terminal. */
  readonly interactive: boolean;

  /**
   * Prints a question and reads one line the person typed.
   *
   * @param question - the whole question, from the message catalogue
   * @returns the typed line; the command accepts only `yes` (trimmed, any case) and treats any other answer, or a rejection, as no
   */
  ask(question: string): Promise<string>;
}

/** The programs the installer checks the version of (the Runtime port of DR-305); the scenarios replace both with fake commands. */
export interface Runtime {
  /**
   * Reads the version of the Node that runs the installer, which a component's `depends.runtime` range is checked against.
   *
   * @returns the version with or without a leading `v`, such as `v24.12.0`
   */
  nodeVersion(): string;

  /**
   * Reports what `git --version` printed.
   *
   * @returns the text, or `undefined` when git could not be run
   */
  gitVersionText(): string | undefined;
}

/** One Markdown file of a component, as the citation scan reads it. */
export interface MarkdownFile {
  /** The path relative to the component root, with `/` separators. */
  readonly file: string;
  /** The whole text; a file over the adapter's size limit is left out, never cut. */
  readonly text: string;
}

/** What a path below a root is on disk, links followed and kept inside the root. */
export type EntryKind = 'file' | 'folder' | 'other' | 'missing';

/**
 * Reads folders and files for the install pipeline and answers what is at a path. Every method only reads. The adapter proves that a
 * relative path keeps under its root once links are followed (M-03, M-04) and answers `missing` or `undefined` when it does not.
 */
export interface DiskReader {
  /**
   * Lists the names directly inside a folder, for a shared location that is linked entry by entry (FR-027).
   *
   * @param folder - the absolute folder of a component's location
   * @returns the names, sorted, without `.` and `..`; `undefined` when the folder is not there or cannot be read
   */
  listEntries(folder: string): readonly string[] | undefined;

  /**
   * Reads every Markdown file below a component root for the citation scan, skipping `.git` and `node_modules` and never following a link.
   *
   * @param root - the absolute component root
   * @returns the files in path order, within the adapter's limits for count and size
   */
  markdownFiles(root: string): readonly MarkdownFile[];

  /**
   * Reads one text file below a root.
   *
   * @param root - the absolute root the file must stay under
   * @param relative - the path below the root, `/` separators
   * @returns the text; `undefined` when the file is missing, is not a regular file, is too large or cannot be read
   */
  readOptionalText(root: string, relative: string): string | undefined;

  /**
   * Tells what is at a path below a root.
   *
   * @param root - the absolute root the path must stay under
   * @param relative - the path below the root, `/` separators
   * @returns the kind, `missing` when nothing is there or the path leaves the root
   */
  entryKind(root: string, relative: string): EntryKind;

  /**
   * Looks at one absolute path without following a link at its end, for the old state of a link the run places.
   *
   * @param target - an absolute path
   * @returns nothing there, a link with its target text, a folder, a regular file, something else, or `unknown`
   */
  observe(target: string): WiringObservation;
}
