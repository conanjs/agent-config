// The git program as the sources module uses it (DR-305, DR-609), owned here and answered by an adapter: the real one runs git
// without a shell (infrastructure/NodeGit.ts). The four method names are the ones the fault adapter of the scenario layer wraps:
// `clone` and `fetch` can be made to fail for a component, `revParse` and `checkout` never are. Every method is asynchronous.

/** What a git operation is about: the component, where it comes from and where the managed clone lives. */
export interface GitRequest {
  /** The component id; a fault names the component it fails for. */
  readonly component: string;
  /** The source address, already checked against the git policy. */
  readonly url: string;
  /** The absolute folder of the managed clone. */
  readonly dest: string;
}

/** A git operation that ended badly; the adapter rejects with an error that has these fields (it may have more). */
export interface GitFailure {
  /** What git wrote to standard error, which the adapter pipes and never inherits (M-07); printed only through MG-32.cause. */
  readonly stderr?: string;
  /** True when the adapter stopped git after its time limit (M-05). */
  readonly timedOut?: boolean;
}

/** The operations on one managed clone. */
export interface GitPort {
  /**
   * Clones the whole repository without checking anything out, with `core.symlinks` off so a link in the repository becomes a plain
   * file (M-04), without submodules and without a shell, after `--`.
   *
   * @param request - the component, the address and the folder that must not exist yet
   * @returns nothing; a failure rejects and leaves no folder behind
   */
  clone(request: GitRequest): Promise<void>;

  /**
   * Brings every branch and tag of the source into the clone, moving a tag that moved at the source, without submodules.
   *
   * @param request - the component, the address and the existing clone
   * @returns nothing; a failure rejects and leaves the clone as it was
   */
  fetch(request: GitRequest): Promise<void>;

  /**
   * Gives the commit a name resolves to in a clone.
   *
   * @param folder - the managed clone
   * @param name - a full ref name or a commit id with `^{commit}`; `HEAD` when left out
   * @returns the full commit id (40 hex characters); a name that resolves to nothing rejects
   */
  revParse(folder: string, name?: string): Promise<string>;

  /**
   * Puts the working tree of the clone at one commit, detached, without submodules and with `core.symlinks` off (M-04).
   *
   * @param request - the component, the address, the clone, and the commit as 40 hex characters
   * @returns nothing
   */
  checkout(request: GitRequest & { readonly ref: string }): Promise<void>;
}
