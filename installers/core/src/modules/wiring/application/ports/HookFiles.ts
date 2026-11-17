/** What reading the agent hook and settings files gave. */
export interface HookFileTexts {
  /** The text of each file that exists and was read, cut at a size limit. */
  readonly texts: readonly string[];
  /** True when a file exists but could not be read or was longer than the limit, so the check cannot be sure (M-14). */
  readonly unreadable: boolean;
}

/**
 * The agent files that can hold a hook command (the settings and hook files of the three agents), owned here and answered by an adapter.
 * Only text is read; nothing in them is parsed as code or run.
 */
export interface HookFiles {
  /**
   * Reads every hook or settings file that exists.
   *
   * @returns their texts, and whether any file could not be read
   */
  readAll(): HookFileTexts;
}
