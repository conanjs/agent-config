// What acquiring a source gives: plain data the commands turn into lines, lock entries and exit codes (specs/022 T133, FR-020).

/** What the lock holds for a git source before this run, as the state module reads it. */
export interface LockedGit {
  /** The 40 hex characters of the commit `install` checks out again (M-02). */
  readonly commit: string;
  /** The tag the entry's ref named when it was locked; absent when the ref is a branch or a commit. */
  readonly tag?: string;
}

/** A git source of a list entry, with where its managed clone lives and what the lock says. */
export interface GitAcquireRequest {
  /** The component id. */
  readonly name: string;
  /** The source address from the list. */
  readonly url: string;
  /** The branch, tag or commit from the list. */
  readonly ref: string;
  /** The absolute folder of the managed clone, `{home}/components/<name>`. */
  readonly dest: string;
  /** The lock entry of the component, when it has one. */
  readonly locked: LockedGit | undefined;
  /** True only for `install --update`, which alone advances a git source (AC-3.9, M-02). */
  readonly update: boolean;
}

/** The clone is at the commit the run will use. */
export interface GitAcquired {
  /** Tells this answer from the others of its type. */
  readonly kind: 'acquired';
  /** The component id. */
  readonly name: string;
  /** The source address, for the message. */
  readonly url: string;
  /** The ref from the list, for the message. */
  readonly ref: string;
  /** The 40 hex characters of the commit now checked out. */
  readonly commit: string;
  /** The tag the ref names, so the lock can pin it (M-02). */
  readonly tag: string | undefined;
  /** The commit the lock held before, when it differs from `commit`; `install --update` prints the range. */
  readonly advancedFrom: string | undefined;
  /** True when the clone holds a `.gitmodules` file: the submodules are ignored and the run warns (M-05). */
  readonly submodules: boolean;
}

/** The source cannot be reached or the ref is not in it; the previous version stays linked (AC-3.4). */
export interface GitFetchFailed {
  /** Tells this answer from the others of its type. */
  readonly kind: 'fetch-failed';
  /** The component id. */
  readonly name: string;
  /** The source address. */
  readonly url: string;
  /** The ref from the list. */
  readonly ref: string;
  /** One line of what git said, trimmed; it is printed only through MG-32.cause, which redacts it (M-07). */
  readonly cause: string;
}

/** The locked tag now names another commit (M-02, AC-3.10): the run fails and changes nothing. */
export interface GitTagMoved {
  /** Tells this answer from the others of its type. */
  readonly kind: 'tag-moved';
  /** The component id. */
  readonly name: string;
  /** The value named by the field. */
  readonly tag: string;
  /** The commit the lock holds. */
  readonly locked: string;
  /** The commit the tag names now, or `gone` when the source no longer has the tag, or `not a commit` when it names something else. */
  readonly current: string;
}

/** The list entry would make git read something other than a repository address or a ref (M-05). */
export interface GitRefused {
  /** Tells this answer from the others of its type. */
  readonly kind: 'refused';
  /** The component id. */
  readonly name: string;
  /** One sentence; it never repeats the refused text, which may hold a secret. */
  readonly reason: string;
}

/** How acquiring one git source ended. */
export type GitAcquireResult = GitAcquired | GitFetchFailed | GitTagMoved | GitRefused;

/** A `path` source that is there: the lock records it live (AC-3.2). */
export interface PathAcquired {
  /** Tells this answer from the others of its type. */
  readonly kind: 'acquired';
  /** The component id. */
  readonly name: string;
  /** The folder as the list wrote it, for the message and the lock. */
  readonly path: string;
}

/** The folder of a `path` source is gone or is not a folder: the run fails with MG-31 (AC-3.3). */
export interface PathMissing {
  /** Tells this answer from the others of its type. */
  readonly kind: 'missing';
  /** The component id. */
  readonly name: string;
  /** The folder the list names. */
  readonly folder: string;
}

/** How acquiring one path source ended. */
export type PathAcquireResult = PathAcquired | PathMissing;

/** A `path` source of a list entry. */
export interface PathAcquireRequest {
  /** The component id. */
  readonly name: string;
  /** The folder as the list wrote it. */
  readonly path: string;
}
